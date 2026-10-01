import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  recurringRuleSchema,
  type RecurringRuleInput,
} from '@nublar/validation';
import { accountRefSelect, toAccountRef } from '../accounts/account-label';
import type { TransactionType } from '../generated/prisma/client';
import { parseBody } from '../common/parse-body';
import { thisMonth } from '../common/today';
import { invoiceDates, invoiceMonthFor, type CardCycle } from '../ledger/cards';
import { shiftMonth } from '../ledger/month';
import {
  occurrenceAmount,
  occurrenceDate,
  occurrenceMonths,
  planEndMonth,
  RECURRING_HORIZON_MONTHS,
} from '../ledger/recurring';
import { PrismaService } from '../prisma/prisma.service';

/** Pending occurrences older than this are not generated retroactively. */
const LOOKBACK_MONTHS = 12;

type Rule = {
  id: string;
  userId: string;
  type: TransactionType;
  accountId: string | null;
  cardId: string | null;
  installments: number | null;
  categoryId: string;
  amount: bigint;
  description: string;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  card: CardCycle | null;
};

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

/**
 * The transaction a rule produces for one month. On a card it is billed on
 * that month's invoice and dated on its due date, which is when the money
 * actually leaves.
 */
export function occurrenceRow(rule: Rule, occurrence: string) {
  const { amount, installmentNumber, installmentCount } = occurrenceAmount(
    rule,
    occurrence,
  );
  const date = rule.card
    ? invoiceDates(occurrence, rule.card).dueDate
    : occurrenceDate(rule, occurrence);
  return {
    userId: rule.userId,
    type: rule.type,
    accountId: rule.accountId,
    cardId: rule.cardId,
    invoiceMonth: rule.cardId ? occurrence : null,
    categoryId: rule.categoryId,
    amount,
    installmentNumber,
    installmentCount,
    description: rule.description,
    date: asDate(date),
    source: 'MANUAL' as const,
    recurringRuleId: rule.id,
    occurrence,
  };
}

@Injectable()
export class RecurringService {
  /** userId → furthest month already materialized by this process. */
  private readonly materialized = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rules = await this.prisma.db.recurringRule.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { dayOfMonth: 'asc' }],
      include: {
        account: { select: accountRefSelect },
        card: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
    return rules.map((rule) => ({
      id: rule.id,
      type: rule.type,
      amount: rule.amount.toString(),
      installments: rule.installments,
      description: rule.description,
      dayOfMonth: rule.dayOfMonth,
      startMonth: rule.startMonth,
      endMonth: planEndMonth(rule),
      account: toAccountRef(rule.account),
      card: rule.card,
      category: rule.category,
    }));
  }

  async create(userId: string, body: unknown) {
    const input = parseBody(recurringRuleSchema, body);
    const card = await this.assertOwnership(userId, input);
    const data = toData(input, card);
    const rule = await this.prisma.db.recurringRule.create({
      data: { userId, ...data },
    });
    if (input.postFirst) {
      // Recorded as it happens: the first occurrence is already real.
      await this.prisma.db.transaction.createMany({
        data: [
          {
            ...occurrenceRow({ ...rule, card }, rule.startMonth),
            status: 'POSTED',
          },
        ],
        skipDuplicates: true,
      });
    }
    this.materialized.delete(userId);
    return { id: rule.id };
  }

  /** Pending occurrences follow the new terms; confirmed ones are history. */
  async update(userId: string, id: string, body: unknown) {
    const input = parseBody(recurringRuleSchema, body);
    await this.find(userId, id);
    const card = await this.assertOwnership(userId, input);
    await this.prisma.db.$transaction([
      this.prisma.db.transaction.deleteMany({
        where: { userId, recurringRuleId: id, status: 'PENDING' },
      }),
      this.prisma.db.recurringRule.update({
        where: { id },
        data: toData(input, card),
      }),
    ]);
    this.materialized.delete(userId);
    return { id };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.find(userId, id);
    await this.prisma.db.$transaction([
      this.prisma.db.transaction.deleteMany({
        where: {
          userId,
          recurringRuleId: id,
          status: { in: ['PENDING', 'CANCELED'] },
        },
      }),
      this.prisma.db.recurringRule.delete({ where: { id } }),
    ]);
    this.materialized.delete(userId);
  }

  /**
   * Makes sure every occurrence up to `month` exists as a PENDING entry.
   * The unique (rule, occurrence) index makes this safe to run concurrently,
   * and a skipped (CANCELED) occurrence is never created again.
   */
  async materialize(userId: string, month: string): Promise<void> {
    const current = thisMonth();
    const horizon = shiftMonth(current, RECURRING_HORIZON_MONTHS);
    const upTo = month < horizon ? month : horizon;
    const done = this.materialized.get(userId);
    if (done && done >= upTo) {
      return;
    }

    const rules: Rule[] = await this.prisma.db.recurringRule.findMany({
      where: { userId },
      include: { card: { select: { closingDay: true, dueDay: true } } },
    });
    const from = shiftMonth(current, -LOOKBACK_MONTHS);
    const rows = rules.flatMap((rule) =>
      occurrenceMonths(
        { ...rule, endMonth: planEndMonth(rule) },
        from,
        upTo,
      ).map((occurrence) => ({
        ...occurrenceRow(rule, occurrence),
        status: 'PENDING' as const,
      })),
    );

    if (rows.length > 0) {
      await this.prisma.db.transaction.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
    this.materialized.set(userId, upTo);
  }

  /** Called when an occurrence changes outside this service. */
  forget(userId: string): void {
    this.materialized.delete(userId);
  }

  private async find(userId: string, id: string) {
    const rule = await this.prisma.db.recurringRule.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!rule) {
      throw new NotFoundException('Recorrência não encontrada');
    }
    return rule;
  }

  /** Checks ownership and returns the card cycle when billed on a card. */
  private async assertOwnership(
    userId: string,
    input: RecurringRuleInput,
  ): Promise<CardCycle | null> {
    const category = await this.prisma.db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { kind: true },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    if (category.kind !== input.type) {
      throw new BadRequestException(
        'A categoria não combina com o tipo da recorrência',
      );
    }
    if (input.cardId) {
      const card = await this.prisma.db.creditCard.findFirst({
        where: { id: input.cardId, userId },
        select: { closingDay: true, dueDay: true },
      });
      if (!card) {
        throw new NotFoundException('Cartão não encontrado');
      }
      return card;
    }
    const account = await this.prisma.db.account.findFirst({
      where: { id: input.accountId ?? undefined, userId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }
    return null;
  }
}

function toData(input: RecurringRuleInput, card: CardCycle | null) {
  // On a card the first charge lands on the invoice of its purchase date.
  const startMonth =
    card && input.startDate
      ? invoiceMonthFor(input.startDate, card)
      : input.startMonth;
  return {
    type: input.type,
    accountId: card ? null : (input.accountId ?? null),
    cardId: card ? (input.cardId ?? null) : null,
    installments: input.installments ?? null,
    categoryId: input.categoryId,
    amount: input.amount,
    description: input.description ?? '',
    dayOfMonth: input.dayOfMonth ?? 1,
    startMonth,
    endMonth: input.installments ? null : (input.endMonth ?? null),
  };
}
