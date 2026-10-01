import { BadRequestException, Injectable } from '@nestjs/common';
import { calendarMonthSchema } from '@nublar/validation';
import { thisMonth, today } from '../common/today';
import { dayOf } from '../ledger/cards';
import { positionsValueAt } from '../ledger/investments';
import {
  availableCash,
  competenceMonth,
  entriesUntil,
  monthExpenseByCategory,
  monthExpenseComposition,
  monthIncomeAndExpense,
  monthInvested,
  netWorth,
  type LedgerEntry,
} from '../ledger/ledger';
import { LedgerService } from '../ledger/ledger.service';
import { shiftMonth } from '../ledger/month';
import {
  occurrenceAmount,
  occurrenceMonths,
  planEndMonth,
  type RecurringPlan,
} from '../ledger/recurring';
import { PrismaService } from '../prisma/prisma.service';

const assetClassNames = {
  FIXED_INCOME: 'Renda fixa',
  STOCK: 'Ações',
  FII: 'FIIs',
  ETF: 'ETFs',
  CRYPTO: 'Cripto',
  OTHER: 'Outros',
} as const;

const COMMITMENT_MONTHS = 6;

/** Share in basis points (1% = 100); null when the base is not positive. */
export function bps(part: bigint, whole: bigint): number | null {
  return whole > 0n ? Number((part * 10000n) / whole) : null;
}

/** Integer average in minor units (truncated), 0 for no values. */
export function average(values: bigint[]): bigint {
  if (values.length === 0) {
    return 0n;
  }
  return values.reduce((sum, value) => sum + value, 0n) / BigInt(values.length);
}

export type CommitmentRule = RecurringPlan & {
  id: string;
  type: string;
};

/**
 * Money already known for a future month: card installments billed on its
 * invoice, installment plans, fixed costs and recurring income. Skipped
 * occurrences are left out; confirmed ones count with their real amount.
 */
export function committedIn(
  month: string,
  entries: LedgerEntry[],
  rules: CommitmentRule[],
  recurringRows: {
    recurringRuleId: string | null;
    occurrence: string | null;
    status: string;
    amount: bigint;
  }[],
) {
  let installments = 0n;
  for (const entry of entries) {
    if (
      entry.cardId &&
      entry.type === 'EXPENSE' &&
      entry.invoiceMonth === month &&
      // Recurring rows are counted from their rules below.
      !entry.recurring
    ) {
      installments += entry.amount;
    }
  }
  const rows = new Map(
    recurringRows.map((row) => [
      `${row.recurringRuleId}:${row.occurrence}`,
      row,
    ]),
  );
  let recurringExpense = 0n;
  let recurringIncome = 0n;
  for (const rule of rules) {
    const plan = { ...rule, endMonth: planEndMonth(rule) };
    if (occurrenceMonths(plan, month, month).length === 0) continue;
    const row = rows.get(`${rule.id}:${month}`);
    if (row?.status === 'CANCELED') continue;
    const amount = row?.amount ?? occurrenceAmount(rule, month).amount;
    if (rule.type === 'INCOME') recurringIncome += amount;
    else if (rule.installments) installments += amount;
    else recurringExpense += amount;
  }
  return { installments, recurringExpense, recurringIncome };
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Everything the dashboard draws, for the `months` months ending at `to`
   * (never past the current month). All money is minor units as strings.
   */
  async overview(
    userId: string,
    rawTo: string | undefined,
    rawMonths: string | undefined,
  ) {
    const current = thisMonth();
    const now = today();
    const requested = rawTo ?? current;
    if (!calendarMonthSchema.safeParse(requested).success) {
      throw new BadRequestException('Mês deve usar AAAA-MM');
    }
    const to = requested > current ? current : requested;
    const months = Math.min(Math.max(Number(rawMonths ?? 12) || 12, 3), 36);
    const from = shiftMonth(to, -(months - 1));

    const [entries, accounts, positions, categories, rules, recurringRows] =
      await Promise.all([
        this.ledger.entries(userId),
        this.ledger.accounts(userId),
        this.ledger.positions(userId),
        this.prisma.db.category.findMany({
          where: { userId },
          select: { id: true, name: true },
        }),
        this.prisma.db.recurringRule.findMany({ where: { userId } }),
        this.prisma.db.transaction.findMany({
          where: { userId, recurringRuleId: { not: null } },
          select: {
            recurringRuleId: true,
            occurrence: true,
            status: true,
            amount: true,
          },
        }),
      ]);
    const names = new Map(categories.map((c) => [c.id, c.name]));

    // Averages only count months the user was already tracking.
    let firstMonth = to;
    for (const entry of entries) {
      const month = competenceMonth(entry);
      if (month < firstMonth) firstMonth = month;
    }

    const series = [];
    for (let month = from; month <= to; month = shiftMonth(month, 1)) {
      const end = month === current ? now : dayOf(month, 31);
      const until = entriesUntil(entries, end);
      const investments = positionsValueAt(positions, end);
      const cash = availableCash(accounts, until);
      const worth = netWorth(accounts, until, investments);
      const flow = monthIncomeAndExpense(entries, month);
      const composition = monthExpenseComposition(entries, month);
      series.push({
        month,
        tracked: month >= firstMonth,
        income: flow.income,
        expense: flow.expense,
        result: flow.income - flow.expense,
        invested: monthInvested(entries, month),
        savingsRateBps: bps(flow.income - flow.expense, flow.income),
        fixed: composition.fixed,
        installments: composition.installments,
        variable: composition.variable,
        netWorth: worth,
        cash,
        investments,
        cardDebt: cash + investments - worth,
      });
    }

    const tracked = series.filter((point) => point.tracked);
    const last = series[series.length - 1];
    const first = series[0];
    const totalIncome = tracked.reduce((sum, p) => sum + p.income, 0n);
    const totalExpense = tracked.reduce((sum, p) => sum + p.expense, 0n);

    // Categories of the last month against the previous one and the average
    // of the three months before it.
    const byCategory = new Map<
      string | null,
      { now: bigint; prev: bigint; avg: bigint[] }
    >();
    const touch = (id: string | null) => {
      if (!byCategory.has(id))
        byCategory.set(id, { now: 0n, prev: 0n, avg: [] });
      return byCategory.get(id)!;
    };
    for (const group of monthExpenseByCategory(entries, to)) {
      touch(group.categoryId).now = group.amount;
    }
    for (const group of monthExpenseByCategory(entries, shiftMonth(to, -1))) {
      touch(group.categoryId).prev = group.amount;
    }
    const baseline = [1, 2, 3]
      .map((back) => shiftMonth(to, -back))
      .filter((month) => month >= firstMonth);
    for (const month of baseline) {
      const amounts = new Map(
        monthExpenseByCategory(entries, month).map((g) => [
          g.categoryId,
          g.amount,
        ]),
      );
      for (const [id, data] of byCategory) {
        data.avg.push(amounts.get(id) ?? 0n);
      }
      for (const [id, amount] of amounts) {
        if (!byCategory.has(id)) {
          const data = touch(id);
          data.avg = [
            ...Array.from({ length: data.avg.length }, () => 0n),
            amount,
          ];
        }
      }
    }

    // Allocation of what the user owns today.
    const nowPositions = new Map<string, bigint>();
    for (const position of positions) {
      const value = positionsValueAt([position], now);
      nowPositions.set(
        position.assetClass,
        (nowPositions.get(position.assetClass) ?? 0n) + value,
      );
    }
    const allocation = [
      { key: 'CASH', name: 'Contas', value: last.cash > 0n ? last.cash : 0n },
      ...[...nowPositions.entries()].map(([key, value]) => ({
        key,
        name: assetClassNames[key as keyof typeof assetClassNames],
        value,
      })),
    ]
      .filter((slice) => slice.value > 0n)
      .sort((a, b) => (a.value === b.value ? 0 : a.value > b.value ? -1 : 1));

    // What is already committed in the coming months.
    const commitments = [];
    for (let step = 1; step <= COMMITMENT_MONTHS; step++) {
      const month = shiftMonth(current, step);
      const known = committedIn(month, entries, rules, recurringRows);
      commitments.push({
        month,
        installments: known.installments.toString(),
        recurringExpense: known.recurringExpense.toString(),
        recurringIncome: known.recurringIncome.toString(),
        balance: (
          known.recurringIncome -
          known.recurringExpense -
          known.installments
        ).toString(),
      });
    }

    return {
      from,
      to,
      kpis: {
        netWorth: last.netWorth.toString(),
        netWorthChange: (last.netWorth - first.netWorth).toString(),
        netWorthChangeBps: bps(last.netWorth - first.netWorth, first.netWorth),
        averageIncome: average(tracked.map((p) => p.income)).toString(),
        averageExpense: average(tracked.map((p) => p.expense)).toString(),
        savingsRateBps: bps(totalIncome - totalExpense, totalIncome),
        invested: tracked.reduce((sum, p) => sum + p.invested, 0n).toString(),
        trackedMonths: tracked.length,
      },
      series: series.map((point) => ({
        month: point.month,
        tracked: point.tracked,
        income: point.income.toString(),
        expense: point.expense.toString(),
        result: point.result.toString(),
        invested: point.invested.toString(),
        savingsRateBps: point.savingsRateBps,
        fixed: point.fixed.toString(),
        installments: point.installments.toString(),
        variable: point.variable.toString(),
        netWorth: point.netWorth.toString(),
        cash: point.cash.toString(),
        investments: point.investments.toString(),
        cardDebt: point.cardDebt.toString(),
      })),
      categories: [...byCategory.entries()]
        .map(([categoryId, data]) => ({
          categoryId,
          name: (categoryId && names.get(categoryId)) || 'Sem categoria',
          amount: data.now,
          previous: data.prev,
          average: average(data.avg),
        }))
        .filter((c) => c.amount > 0n || c.previous > 0n || c.average > 0n)
        .sort((a, b) =>
          a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1,
        )
        .map((c) => ({
          ...c,
          amount: c.amount.toString(),
          previous: c.previous.toString(),
          average: c.average.toString(),
        })),
      allocation: allocation.map((slice) => ({
        ...slice,
        value: slice.value.toString(),
      })),
      commitments,
    };
  }
}
