import { dayOf, splitInstallments } from './cards';
import { shiftMonth } from './month';

export type RecurringSchedule = {
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
};

/** How far ahead pending occurrences are generated. */
export const RECURRING_HORIZON_MONTHS = 12;

/** Months in [from, to] in which the schedule produces an occurrence. */
export function occurrenceMonths(
  schedule: RecurringSchedule,
  from: string,
  to: string,
): string[] {
  const start = schedule.startMonth > from ? schedule.startMonth : from;
  const end =
    schedule.endMonth && schedule.endMonth < to ? schedule.endMonth : to;
  const months: string[] = [];
  for (let month = start; month <= end; month = shiftMonth(month, 1)) {
    months.push(month);
  }
  return months;
}

export function occurrenceDate(
  schedule: RecurringSchedule,
  month: string,
): string {
  return dayOf(month, schedule.dayOfMonth);
}

export type RecurringPlan = RecurringSchedule & {
  amount: bigint;
  /** Set for "parcelado em N vezes": `amount` is then the total. */
  installments: number | null;
};

/** Last month of a plan: fixed by the installment count when there is one. */
export function planEndMonth(plan: {
  startMonth: string;
  endMonth: string | null;
  installments: number | null;
}): string | null {
  return plan.installments
    ? shiftMonth(plan.startMonth, plan.installments - 1)
    : plan.endMonth;
}

/**
 * Amount and installment position of the occurrence in `month`.
 * Installment plans split the total like card purchases: the leftover cent
 * goes to the first one.
 */
export function occurrenceAmount(
  plan: RecurringPlan,
  month: string,
): {
  amount: bigint;
  installmentNumber: number | null;
  installmentCount: number | null;
} {
  if (!plan.installments) {
    return {
      amount: plan.amount,
      installmentNumber: null,
      installmentCount: null,
    };
  }
  const [startYear, startMonth] = plan.startMonth.split('-').map(Number);
  const [year, monthNumber] = month.split('-').map(Number);
  const index = (year - startYear) * 12 + (monthNumber - startMonth);
  const parts = splitInstallments(plan.amount, plan.installments);
  return {
    amount: parts[index] ?? 0n,
    installmentNumber: index + 1,
    installmentCount: plan.installments,
  };
}
