import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  calendarMonthSchema,
  cardPaymentSchema,
  cardPurchaseSchema,
  creditCardSchema,
  type CardPurchaseInput,
} from '@nublar/validation';
import { accountRefSelect, toAccountRef } from '../accounts/account-label';
import { parseBody } from '../common/parse-body';
import { assertInstitution } from '../institutions/assert-institution';
import { today } from '../common/today';
import {
  invoiceDates,
  invoiceMonthFor,
  invoiceStatus,
  splitInstallments,
  type CardCycle,
} from '../ledger/cards';
import { cardDebt, invoiceTotals, type LedgerEntry } from '../ledger/ledger';
import { LedgerService } from '../ledger/ledger.service';
import { shiftMonth } from '../ledger/month';
import { PrismaService } from '../prisma/prisma.service';

export type Card = CardCycle & {
  id: string;
  institutionId: string | null;
  name: string;
  limit: bigint;
  paymentAccountId: string | null;
};

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async list(userId: string) {
    const [cards, entries] = await Promise.all([
      this.prisma.db.creditCard.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      }),
      this.ledger.entries(userId),
    ]);
    const now = today();

    return cards.map((card) => {
      const debt = cardDebt(card.id, entries);
      // The invoice that matters most: a closed one still unpaid, otherwise
      // the open one that today's purchases go into.
      const openMonth = invoiceMonthFor(now, card);
      const previous = describeInvoice(
        card,
        shiftMonth(openMonth, -1),
        entries,
        now,
      );
      const currentInvoice =
        previous.status === 'CLOSED' || previous.status === 'OVERDUE'
          ? previous
          : describeInvoice(card, openMonth, entries, now);
      return {
        ...serializeCard(card),
        debt: debt.toString(),
        available: (card.limit - debt).toString(),
        currentInvoice,
      };
    });
  }

  async create(userId: string, body: unknown) {
    const input = parseBody(creditCardSchema, body);
    await this.assertAccount(userId, input.paymentAccountId);
    await assertInstitution(this.prisma, userId, input.institutionId);
    const card = await this.prisma.db.creditCard.create({
      data: {
        userId,
        institutionId: input.institutionId ?? null,
        name: input.name,
        limit: input.limit,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        paymentAccountId: input.paymentAccountId ?? null,
      },
    });
    return serializeCard(card);
  }

  /**
   * New closing/due days apply to purchases from now on; installments
   * already billed keep the invoice they were assigned to.
   */
  async update(userId: string, id: string, body: unknown) {
    const input = parseBody(creditCardSchema, body);
    await this.find(userId, id);
    await this.assertAccount(userId, input.paymentAccountId);
    await assertInstitution(this.prisma, userId, input.institutionId);
    const card = await this.prisma.db.creditCard.update({
      where: { id },
      data: {
        institutionId: input.institutionId,
        name: input.name,
        limit: input.limit,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        paymentAccountId: input.paymentAccountId ?? null,
      },
    });
    return serializeCard(card);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.find(userId, id);
    const [used, rules] = await Promise.all([
      this.prisma.db.transaction.count({ where: { userId, cardId: id } }),
      this.prisma.db.recurringRule.count({ where: { userId, cardId: id } }),
    ]);
    if (rules > 0) {
      throw new ConflictException(
        'Este cartão é usado por uma recorrência. Remova-a antes.',
      );
    }
    if (used > 0) {
      throw new ConflictException(
        'Este cartão tem compras ou pagamentos. Exclua-os antes de remover o cartão.',
      );
    }
    await this.prisma.db.creditCard.delete({ where: { id } });
  }

  async invoice(userId: string, id: string, rawMonth: string) {
    const parsed = calendarMonthSchema.safeParse(rawMonth);
    if (!parsed.success) {
      throw new BadRequestException('Mês deve usar AAAA-MM');
    }
    const month = parsed.data;
    const card = await this.find(userId, id);
    const [entries, rows] = await Promise.all([
      this.ledger.entries(userId),
      this.prisma.db.transaction.findMany({
        where: { userId, cardId: id, invoiceMonth: month },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          account: { select: accountRefSelect },
          category: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      card: serializeCard(card),
      ...describeInvoice(card, month, entries, today()),
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        amount: row.amount.toString(),
        description: row.description,
        date: row.date.toISOString().slice(0, 10),
        purchaseId: row.purchaseId,
        installmentNumber: row.installmentNumber,
        installmentCount: row.installmentCount,
        category: row.category,
        account: toAccountRef(row.account),
      })),
    };
  }

  async pay(userId: string, id: string, body: unknown) {
    const input = parseBody(cardPaymentSchema, body);
    const card = await this.find(userId, id);
    await this.assertAccount(userId, input.accountId);
    const payment = await this.prisma.db.transaction.create({
      data: {
        userId,
        type: 'CARD_PAYMENT',
        accountId: input.accountId,
        cardId: id,
        invoiceMonth: input.invoiceMonth,
        amount: input.amount,
        description: `Fatura ${card.name}`,
        date: new Date(`${input.date}T00:00:00.000Z`),
        source: 'MANUAL',
        status: 'POSTED',
      },
    });
    return { id: payment.id };
  }

  async createPurchase(userId: string, body: unknown) {
    const input = parseBody(cardPurchaseSchema, body);
    const card = await this.assertPurchase(userId, input);
    const purchase = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.cardPurchase.create({
        data: {
          userId,
          cardId: input.cardId,
          categoryId: input.categoryId,
          description: input.description ?? '',
          amount: input.amount,
          installments: input.installments,
          date: new Date(`${input.date}T00:00:00.000Z`),
        },
      });
      await tx.transaction.createMany({
        data: installmentRows(userId, created.id, card, input),
      });
      return created;
    });
    return { id: purchase.id };
  }

  /** Re-plans every installment; simpler and safer than diffing them. */
  async updatePurchase(userId: string, id: string, body: unknown) {
    const input = parseBody(cardPurchaseSchema, body);
    await this.findPurchase(userId, id);
    const card = await this.assertPurchase(userId, input);
    await this.prisma.db.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { purchaseId: id } });
      await tx.cardPurchase.update({
        where: { id },
        data: {
          cardId: input.cardId,
          categoryId: input.categoryId,
          description: input.description ?? '',
          amount: input.amount,
          installments: input.installments,
          date: new Date(`${input.date}T00:00:00.000Z`),
        },
      });
      await tx.transaction.createMany({
        data: installmentRows(userId, id, card, input),
      });
    });
    return { id };
  }

  async removePurchase(userId: string, id: string): Promise<void> {
    await this.findPurchase(userId, id);
    await this.prisma.db.cardPurchase.delete({ where: { id } });
  }

  private async find(userId: string, id: string): Promise<Card> {
    const card = await this.prisma.db.creditCard.findFirst({
      where: { id, userId },
    });
    if (!card) {
      throw new NotFoundException('Cartão não encontrado');
    }
    return card;
  }

  private async findPurchase(userId: string, id: string) {
    const purchase = await this.prisma.db.cardPurchase.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!purchase) {
      throw new NotFoundException('Compra não encontrada');
    }
    return purchase;
  }

  private async assertAccount(
    userId: string,
    accountId: string | null | undefined,
  ): Promise<void> {
    if (!accountId) {
      return;
    }
    const account = await this.prisma.db.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }
  }

  private async assertPurchase(
    userId: string,
    input: CardPurchaseInput,
  ): Promise<Card> {
    const [card, category] = await Promise.all([
      this.find(userId, input.cardId),
      this.prisma.db.category.findFirst({
        where: { id: input.categoryId, userId },
        select: { kind: true },
      }),
    ]);
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    if (category.kind !== 'EXPENSE') {
      throw new BadRequestException(
        'Compras no cartão usam categoria de despesa',
      );
    }
    return card;
  }
}

export function describeInvoice(
  card: Card,
  month: string,
  entries: LedgerEntry[],
  now: string,
) {
  const totals = invoiceTotals(card.id, month, entries);
  const dates = invoiceDates(month, card);
  const remaining = totals.total - totals.paid;
  return {
    month,
    ...dates,
    total: totals.total.toString(),
    paid: totals.paid.toString(),
    remaining: (remaining > 0n ? remaining : 0n).toString(),
    status: invoiceStatus({ ...totals, ...dates, today: now }),
  };
}

function serializeCard(card: Card) {
  return {
    id: card.id,
    name: card.name,
    limit: card.limit.toString(),
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    paymentAccountId: card.paymentAccountId,
    institutionId: card.institutionId,
  };
}

export function installmentRows(
  userId: string,
  purchaseId: string,
  card: Card,
  input: CardPurchaseInput,
) {
  const firstInvoice = invoiceMonthFor(input.date, card);
  return splitInstallments(input.amount, input.installments).map(
    (amount, index) => ({
      userId,
      type: 'EXPENSE' as const,
      accountId: null,
      cardId: card.id,
      categoryId: input.categoryId,
      purchaseId,
      installmentNumber: index + 1,
      installmentCount: input.installments,
      invoiceMonth: shiftMonth(firstInvoice, index),
      amount,
      description: input.description ?? '',
      date: new Date(`${input.date}T00:00:00.000Z`),
      source: 'MANUAL' as const,
      status: 'POSTED' as const,
    }),
  );
}
