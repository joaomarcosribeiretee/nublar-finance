import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  calendarMonthSchema,
  confirmOccurrenceSchema,
  createTransactionSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
} from '@nublar/validation';
import { CategoryKind } from '../generated/prisma/client';
import {
  accountRefSelect,
  toAccountRef,
  type accountTypeNames,
} from '../accounts/account-label';
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
import { PrismaService } from '../prisma/prisma.service';
import { RecurringService } from '../recurring/recurring.service';

const withRelations = {
  account: { select: accountRefSelect },
  destinationAccount: { select: accountRefSelect },
  category: { select: { id: true, name: true, kind: true } },
  card: { select: { id: true, name: true } },
  investment: { select: { id: true, name: true } },
  purchase: {
    select: {
      id: true,
      amount: true,
      installments: true,
      date: true,
      description: true,
    },
  },
} as const;

type AccountRefRow = {
  id: string;
  name: string;
  type: keyof typeof accountTypeNames;
  institution: { name: string } | null;
};

type TransactionWithRelations = {
  id: string;
  type: string;
  status: string;
  amount: bigint;
  currency: string;
  description: string;
  date: Date;
  invoiceMonth: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  recurringRuleId: string | null;
  account: AccountRefRow | null;
  destinationAccount: AccountRefRow | null;
  category: { id: string; name: string; kind: string } | null;
  card: { id: string; name: string } | null;
  investment: { id: string; name: string } | null;
  purchase: {
    id: string;
    amount: bigint;
    installments: number;
    date: Date;
    description: string;
  } | null;
};

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
        OR: [
          { purchaseId: { not: null }, invoiceMonth: parsed },
          { purchaseId: null, date: monthRange(parsed) },
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
    if (existing.recurringRuleId && existing.status === 'PENDING') {
      await this.prisma.db.transaction.update({
        where: { id },
        data: { status: 'CANCELED' },
      });
      return;
    }
    await this.prisma.db.transaction.delete({ where: { id } });
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

function serialize(transaction: TransactionWithRelations) {
  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount.toString(),
    currency: transaction.currency,
    description: transaction.description,
    date: transaction.date.toISOString().slice(0, 10),
    invoiceMonth: transaction.invoiceMonth,
    installmentNumber: transaction.installmentNumber,
    installmentCount: transaction.installmentCount,
    recurring: transaction.recurringRuleId !== null,
    account: toAccountRef(transaction.account),
    destinationAccount: toAccountRef(transaction.destinationAccount),
    category: transaction.category,
    card: transaction.card,
    investment: transaction.investment,
    purchase: transaction.purchase
      ? {
          id: transaction.purchase.id,
          amount: transaction.purchase.amount.toString(),
          installments: transaction.purchase.installments,
          date: transaction.purchase.date.toISOString().slice(0, 10),
          description: transaction.purchase.description,
        }
      : null,
  };
}
