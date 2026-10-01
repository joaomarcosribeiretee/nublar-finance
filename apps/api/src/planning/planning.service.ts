import { BadRequestException, Injectable } from '@nestjs/common';
import { calendarMonthSchema } from '@nublar/validation';
import { accountRefSelect, toAccountRef } from '../accounts/account-label';
import { average, committedIn } from '../analytics/analytics.service';
import { thisMonth, today } from '../common/today';
import { dayOf, invoiceDates } from '../ledger/cards';
import {
  availableCash,
  competenceMonth,
  entriesUntil,
  monthExpenseComposition,
  type LedgerEntry,
} from '../ledger/ledger';
import { LedgerService } from '../ledger/ledger.service';
import { monthRange, shiftMonth } from '../ledger/month';
import { projectCash } from '../ledger/planning';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringService } from '../recurring/recurring.service';

type CalendarEvent = {
  id: string;
  kind: string;
  status: string;
  date: string;
  title: string;
  subtitle: string;
  amount: string;
};

/** Effect of one entry on account cash (cards only move cash when paid). */
function cashEffect(entry: LedgerEntry): bigint {
  if (!entry.accountId || entry.type === 'TRANSFER') return 0n;
  if (entry.type === 'INCOME' || entry.type === 'REDEMPTION')
    return entry.amount;
  return -entry.amount;
}

/** What a card invoice will cost on its due date: billed + scheduled − paid. */
function invoiceDue(
  cardId: string,
  month: string,
  entries: LedgerEntry[],
): bigint {
  let due = 0n;
  for (const entry of entries) {
    if (entry.cardId !== cardId || entry.invoiceMonth !== month) continue;
    if (entry.type === 'EXPENSE') due += entry.amount;
    if (entry.type === 'CARD_PAYMENT' && entry.status !== 'PENDING')
      due -= entry.amount;
  }
  return due > 0n ? due : 0n;
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly recurring: RecurringService,
  ) {}

  /**
   * Everything with a date in the month, plus the cash balance day by day:
   * real until today, projected after (scheduled entries and invoice dues).
   */
  async calendar(userId: string, rawMonth: string) {
    if (!calendarMonthSchema.safeParse(rawMonth).success) {
      throw new BadRequestException('Mês deve usar AAAA-MM');
    }
    const month = rawMonth;
    const now = today();
    await this.recurring.materialize(userId, month);
    const [entries, accounts, cards, rows, investments] = await Promise.all([
      this.ledger.entries(userId),
      this.ledger.accounts(userId),
      this.prisma.db.creditCard.findMany({ where: { userId } }),
      this.prisma.db.transaction.findMany({
        where: {
          userId,
          status: { not: 'CANCELED' },
          accountId: { not: null },
          date: monthRange(month),
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        include: {
          account: { select: accountRefSelect },
          category: { select: { name: true } },
          investment: { select: { name: true } },
          card: { select: { name: true } },
        },
      }),
      this.prisma.db.investment.findMany({
        where: { userId, maturityDate: monthRange(month) },
        select: { id: true, name: true, maturityDate: true },
      }),
    ]);

    const events: CalendarEvent[] = rows.map((row) => ({
      id: row.id,
      kind: row.type,
      status: row.status,
      date: row.date.toISOString().slice(0, 10),
      title:
        row.description ||
        row.category?.name ||
        (row.type === 'CARD_PAYMENT' ? `Fatura ${row.card?.name ?? ''}` : '') ||
        row.investment?.name ||
        'Lançamento',
      subtitle: toAccountRef(row.account)?.name ?? '',
      amount: row.amount.toString(),
    }));
    const dues = new Map<string, bigint>();
    for (const card of cards) {
      const { dueDate } = invoiceDates(month, card);
      const due = invoiceDue(card.id, month, entries);
      if (due === 0n) continue;
      events.push({
        id: `invoice:${card.id}`,
        kind: 'INVOICE',
        status: dueDate < now ? 'POSTED' : 'PENDING',
        date: dueDate,
        title: `Fatura ${card.name}`,
        subtitle: 'Vencimento',
        amount: due.toString(),
      });
      if (dueDate > now) dues.set(dueDate, (dues.get(dueDate) ?? 0n) + due);
    }
    for (const investment of investments) {
      events.push({
        id: `maturity:${investment.id}`,
        kind: 'MATURITY',
        status: 'PENDING',
        date: investment.maturityDate!.toISOString().slice(0, 10),
        title: investment.name,
        subtitle: 'Vencimento do investimento',
        amount: '0',
      });
    }
    events.sort((a, b) => a.date.localeCompare(b.date));

    // Day-by-day cash: real up to today, projected afterwards.
    const posted = entries.filter((e) => e.status !== 'PENDING');
    const start = dayOf(shiftMonth(month, -1), 31);
    let projected = availableCash(accounts, entriesUntil(posted, now));
    const days = [];
    const last = Number(dayOf(month, 31).slice(8, 10));
    for (let day = 1; day <= last; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      if (date <= now) {
        days.push({
          date,
          cash: availableCash(accounts, entriesUntil(posted, date)).toString(),
          projected: false,
        });
        continue;
      }
      for (const entry of entries) {
        if (entry.status === 'PENDING' && entry.date === date) {
          projected += cashEffect(entry);
        }
      }
      projected -= dues.get(date) ?? 0n;
      days.push({ date, cash: projected.toString(), projected: true });
    }

    return {
      month,
      openingCash: availableCash(
        accounts,
        entriesUntil(posted, start),
      ).toString(),
      events,
      days,
    };
  }

  /**
   * Cash at the end of each coming month: what is scheduled (recurring,
   * installments, invoices) plus the average variable spending of the last
   * three months, the part nobody schedules.
   */
  async projection(userId: string, rawMonths: string | undefined) {
    const months = Math.min(Math.max(Number(rawMonths ?? 6) || 6, 1), 24);
    const current = thisMonth();
    const now = today();
    await this.recurring.materialize(userId, shiftMonth(current, months));
    const [entries, accounts, rules, recurringRows, cards] = await Promise.all([
      this.ledger.entries(userId),
      this.ledger.accounts(userId),
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
      this.prisma.db.creditCard.findMany({ where: { userId } }),
    ]);
    const posted = entries.filter((e) => e.status !== 'PENDING');
    const cash = availableCash(accounts, entriesUntil(posted, now));

    let firstMonth = current;
    for (const entry of entries) {
      const month = competenceMonth(entry);
      if (month < firstMonth) firstMonth = month;
    }
    const recent = [1, 2, 3]
      .map((back) => shiftMonth(current, -back))
      .filter((month) => month >= firstMonth);
    const variableEstimate = average(
      recent.map((month) => monthExpenseComposition(posted, month).variable),
    );

    // Rest of this month: what is still pending after today, invoices that
    // still fall due, and the variable spending the month usually still has.
    let restIncome = 0n;
    let restExpense = 0n;
    let restInvoices = 0n;
    for (const card of cards) {
      const { dueDate } = invoiceDates(current, card);
      if (dueDate > now) restInvoices += invoiceDue(card.id, current, entries);
    }
    const spentVariable = monthExpenseComposition(posted, current).variable;
    const restVariable =
      variableEstimate > spentVariable ? variableEstimate - spentVariable : 0n;
    for (const entry of entries) {
      if (
        entry.status !== 'PENDING' ||
        entry.date <= now ||
        !entry.date.startsWith(current)
      )
        continue;
      const effect = cashEffect(entry);
      if (effect > 0n) restIncome += effect;
      else restExpense -= effect;
    }
    const rows = [
      {
        month: current,
        income: restIncome,
        fixed: restExpense,
        installments: restInvoices,
        variableEstimate: restVariable,
      },
    ];
    for (let step = 1; step <= months; step++) {
      const month = shiftMonth(current, step);
      const known = committedIn(month, entries, rules, recurringRows);
      rows.push({
        month,
        income: known.recurringIncome,
        fixed: known.recurringExpense,
        installments: known.installments,
        variableEstimate,
      });
    }

    return {
      startCash: cash.toString(),
      variableEstimate: variableEstimate.toString(),
      basedOnMonths: recent.length,
      months: projectCash(cash, rows).map((row) => ({
        month: row.month,
        income: row.income.toString(),
        fixed: row.fixed.toString(),
        installments: row.installments.toString(),
        variableEstimate: row.variableEstimate.toString(),
        balance: row.balance.toString(),
        projectedCash: row.projectedCash.toString(),
      })),
    };
  }
}
