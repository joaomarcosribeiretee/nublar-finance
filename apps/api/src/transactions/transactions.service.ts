import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  calendarMonthSchema,
  confirmOccurrenceSchema,
  createTransactionSchema,
  quantityToUnits,
  updateOccurrenceSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
} from '@nublar/validation';
import { CategoryKind } from '../generated/prisma/client';
import { describeInvoice } from '../cards/cards.service';
import { parseBody } from '../common/parse-body';
import { today } from '../common/today';
import {
  availableCash,
  monthExpenseByCategory,
  monthIncomeAndExpense,
  netWorth,
} from '../ledger/ledger';
import { positionsValueAt } from '../ledger/investments';
import { LedgerService } from '../ledger/ledger.service';
import { monthRange, shiftMonth } from '../ledger/month';
import { shiftQuantity } from '../investments/investments.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringService } from '../recurring/recurring.service';
import { serialize, withRelations } from './serialize';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly recurring: RecurringService,
  ) {}

  /**
   * Entries of a month by competence: card installments by invoice month,
   * everything else by date.
   */
  async list(userId: string, month?: string) {
    let where: object = { userId, status: { not: 'CANCELED' } };
    if (month) {
      const parsed = parseMonth(month);
      await this.recurring.materialize(userId, parsed);
      where = {
        ...where,
        // Anything charged to a card counts in its invoice month.
        OR: [
          { cardId: { not: null }, type: 'EXPENSE', invoiceMonth: parsed },
          {
            OR: [{ cardId: null }, { type: { not: 'EXPENSE' } }],
            date: monthRange(parsed),
          },
        ],
      };
    }

    const transactions = await this.prisma.db.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: month ? undefined : 100,
      include: withRelations,
    });

    return transactions.map(serialize);
  }

  async create(userId: string, body: unknown) {
    const input = parseBody(createTransactionSchema, body);
    await this.assertOwnership(userId, input);

    const transaction = await this.prisma.db.transaction.create({
      data: {
        userId,
        ...toData(input),
        source: 'MANUAL',
        status: 'POSTED',
      },
      include: withRelations,
    });

    return serialize(transaction);
  }

  async update(userId: string, id: string, body: unknown) {
    const input = parseBody(updateTransactionSchema, body);
    const existing = await this.find(userId, id);
    assertPlain(existing);
    if (existing.recurringRuleId) {
      throw new BadRequestException(
        'Este lançamento é de uma recorrência: edite pela ocorrência.',
      );
    }
    await this.assertOwnership(userId, input);

    const transaction = await this.prisma.db.transaction.update({
      where: { id },
      data: toData(input),
      include: withRelations,
    });

    return serialize(transaction);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.find(userId, id);
    if (existing.purchaseId) {
      throw new BadRequestException(
        'Parcelas são excluídas pela compra. Exclua a compra inteira.',
      );
    }
    // Deleting a recurring occurrence would only make it come back:
    // mark it skipped instead.
    if (existing.recurringRuleId) {
      await this.prisma.db.transaction.update({
        where: { id },
        data: { status: 'CANCELED' },
      });
      return;
    }
    // A crypto movement takes its coins back out of the position.
    const { investment, quantity } = existing;
    const units = quantity ? quantityToUnits(quantity) : null;
    if (investment && units !== null) {
      const held = shiftQuantity(
        investment,
        existing.type === 'INVESTMENT' ? -units : units,
      );
      await this.prisma.db.$transaction([
        this.prisma.db.investment.update({
          where: { id: investment.id },
          data: held,
        }),
        this.prisma.db.transaction.delete({ where: { id } }),
      ]);
      return;
    }
    await this.prisma.db.transaction.delete({ where: { id } });
  }

  /**
   * Edits one occurrence of a recurring rule without detaching it. With
   * scope "following" the rule changes too, and pending occurrences after
   * this one are regenerated with the new terms.
   */
  async updateOccurrence(userId: string, id: string, body: unknown) {
    const input = parseBody(updateOccurrenceSchema, body);
    const existing = await this.prisma.db.transaction.findFirst({
      where: { id, userId },
      select: {
        id: true,
        type: true,
        cardId: true,
        occurrence: true,
        recurringRuleId: true,
        recurringRule: { select: { installments: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('Lançamento não encontrado');
    }
    const ruleId = existing.recurringRuleId;
    if (!ruleId || !existing.occurrence) {
      throw new BadRequestException('Este lançamento não é de uma recorrência');
    }
    const category = await this.prisma.db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { kind: true },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    if (category.kind !== existing.type) {
      throw new BadRequestException(
        'A categoria não combina com o tipo do lançamento',
      );
    }
    // Card occurrences stay on their card: the account is never set.
    const accountId = existing.cardId ? undefined : input.accountId;
    if (accountId) {
      const account = await this.prisma.db.account.findFirst({
        where: { id: accountId, userId },
        select: { id: true },
      });
      if (!account) {
        throw new NotFoundException('Conta não encontrada');
      }
    }
    const description = input.description ?? '';
    const occurrence = existing.occurrence;

    const transaction = await this.prisma.db.$transaction(async (tx) => {
      if (input.scope === 'following') {
        await tx.recurringRule.update({
          where: { id: ruleId },
          data: {
            categoryId: input.categoryId,
            description,
            // An installment plan's amount is its total, not a part.
            amount: existing.recurringRule?.installments
              ? undefined
              : input.amount,
            accountId,
            dayOfMonth: existing.cardId
              ? undefined
              : Number(input.date.slice(8, 10)),
          },
        });
        await tx.transaction.deleteMany({
          where: {
            userId,
            recurringRuleId: ruleId,
            status: 'PENDING',
            occurrence: { gt: occurrence },
          },
        });
      }
      return tx.transaction.update({
        where: { id },
        data: {
          amount: input.amount,
          categoryId: input.categoryId,
          description,
          date: new Date(`${input.date}T00:00:00.000Z`),
          accountId,
        },
        include: withRelations,
      });
    });
    this.recurring.forget(userId);
    return serialize(transaction);
  }

  async confirm(userId: string, id: string, body: unknown) {
    const input = parseBody(confirmOccurrenceSchema, body ?? {});
    const existing = await this.find(userId, id);
    if (existing.status !== 'PENDING') {
      throw new BadRequestException('Este lançamento já foi confirmado');
    }
    const transaction = await this.prisma.db.transaction.update({
      where: { id },
      data: {
        status: 'POSTED',
        amount: input.amount,
        date: input.date ? new Date(`${input.date}T00:00:00.000Z`) : undefined,
      },
      include: withRelations,
    });
    return serialize(transaction);
  }

  async skip(userId: string, id: string): Promise<void> {
    const existing = await this.find(userId, id);
    if (existing.status !== 'PENDING') {
      throw new BadRequestException('Só pendentes podem ser pulados');
    }
    await this.prisma.db.transaction.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
  }

  async summary(userId: string, rawMonth: string) {
    const month = parseMonth(rawMonth);
    await this.recurring.materialize(userId, month);
    const [entries, accounts, categories, cards, pending, positions] =
      await Promise.all([
        this.ledger.entries(userId),
        this.ledger.accounts(userId),
        this.prisma.db.category.findMany({
          where: { userId },
          select: { id: true, name: true },
        }),
        this.prisma.db.creditCard.findMany({ where: { userId } }),
        this.prisma.db.transaction.findMany({
          where: { userId, status: 'PENDING', date: monthRange(month) },
          orderBy: { date: 'asc' },
          include: withRelations,
        }),
        this.ledger.positions(userId),
      ]);
    const flow = monthIncomeAndExpense(entries, month);
    const previous = monthIncomeAndExpense(entries, shiftMonth(month, -1));
    const names = new Map(categories.map((c) => [c.id, c.name]));
    const now = today();
    const investments = positionsValueAt(positions, now);

    return {
      currency: 'BRL',
      month,
      cash: availableCash(accounts, entries).toString(),
      investments: investments.toString(),
      netWorth: netWorth(accounts, entries, investments).toString(),
      income: flow.income.toString(),
      expense: flow.expense.toString(),
      result: (flow.income - flow.expense).toString(),
      previous: {
        income: previous.income.toString(),
        expense: previous.expense.toString(),
      },
      expensesByCategory: monthExpenseByCategory(entries, month).map(
        (group) => ({
          categoryId: group.categoryId,
          name:
            (group.categoryId && names.get(group.categoryId)) ||
            'Sem categoria',
          amount: group.amount.toString(),
        }),
      ),
      pending: pending.map(serialize),
      invoices: cards
        .map((card) => ({
          card: { id: card.id, name: card.name },
          ...describeInvoice(card, month, entries, now),
        }))
        .filter((invoice) => invoice.status !== 'EMPTY'),
    };
  }

  private async find(userId: string, id: string) {
    const existing = await this.prisma.db.transaction.findFirst({
      where: { id, userId },
      select: {
        id: true,
        type: true,
        status: true,
        purchaseId: true,
        recurringRuleId: true,
        quantity: true,
        investment: {
          select: {
            id: true,
            assetClass: true,
            coinId: true,
            quantity: true,
            sats: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Lançamento não encontrado');
    }
    return existing;
  }

  private async assertOwnership(
    userId: string,
    input: CreateTransactionInput,
  ): Promise<void> {
    const account = await this.prisma.db.account.findFirst({
      where: { id: input.accountId, userId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    if (input.type === 'TRANSFER') {
      const destination = await this.prisma.db.account.findFirst({
        where: { id: input.destinationAccountId, userId },
        select: { id: true },
      });
      if (!destination) {
        throw new NotFoundException('Conta não encontrada');
      }
      return;
    }

    const category = await this.prisma.db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { kind: true },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    const expectedKind =
      input.type === 'INCOME' ? CategoryKind.INCOME : CategoryKind.EXPENSE;
    if (category.kind !== expectedKind) {
      throw new BadRequestException(
        'A categoria não combina com o tipo do lançamento',
      );
    }
  }
}

/** Installments and card payments have their own edit flows. */
function assertPlain(existing: { type: string; purchaseId: string | null }) {
  if (existing.purchaseId) {
    throw new BadRequestException('Edite a compra do cartão, não a parcela');
  }
  if (existing.type === 'INVESTMENT' || existing.type === 'REDEMPTION') {
    throw new BadRequestException(
      'Aportes e resgates não são editáveis. Exclua e lance de novo.',
    );
  }
  if (existing.type === 'CARD_PAYMENT') {
    throw new BadRequestException(
      'Pagamentos de fatura não são editáveis. Exclua e pague de novo.',
    );
  }
}

function parseMonth(month: string): string {
  const parsed = calendarMonthSchema.safeParse(month);
  if (!parsed.success) {
    throw new BadRequestException('Mês deve usar AAAA-MM');
  }
  return parsed.data;
}

function toData(input: CreateTransactionInput) {
  return {
    type: input.type,
    accountId: input.accountId,
    destinationAccountId:
      input.type === 'TRANSFER' ? (input.destinationAccountId ?? null) : null,
    categoryId: input.type === 'TRANSFER' ? null : (input.categoryId ?? null),
    amount: input.amount,
    description: input.description ?? '',
    date: new Date(`${input.date}T00:00:00.000Z`),
  };
}
