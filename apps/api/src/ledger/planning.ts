/** Rules from docs/decisions/0003-planejamento.md. */

/** Share in basis points (1% = 100); null when the base is not positive. */
function bps(part: bigint, whole: bigint): number | null {
  return whole > 0n ? Number((part * 10000n) / whole) : null;
}

export type BudgetStatus = 'OK' | 'WARNING' | 'OVER';

/** A budget turns into a warning at 80% and is over past 100%. */
export const BUDGET_WARNING_BPS = 8000;

export function budgetStatus(spent: bigint, limit: bigint) {
  const used = bps(spent, limit) ?? 0;
  const status: BudgetStatus =
    spent > limit ? 'OVER' : used >= BUDGET_WARNING_BPS ? 'WARNING' : 'OK';
  return { remaining: limit - spent, usedBps: used, status };
}

/**
 * Months left to save, counting the current one: from 2026-10-15 to
 * 2027-03-01 there are October … March = 6 months.
 */
export function monthsUntil(today: string, target: string): number {
  const [y1, m1] = today.split('-').map(Number);
  const [y2, m2] = target.split('-').map(Number);
  return Math.max((y2 - y1) * 12 + (m2 - m1) + 1, 0);
}

export function goalPlan(input: {
  target: bigint;
  saved: bigint;
  targetDate: string | null;
  today: string;
}) {
  const remaining =
    input.target > input.saved ? input.target - input.saved : 0n;
  const months = input.targetDate
    ? monthsUntil(input.today, input.targetDate)
    : null;
  // Round up so following the plan actually reaches the target.
  const monthly =
    remaining === 0n || months === null
      ? null
      : months === 0
        ? remaining
        : (remaining + BigInt(months) - 1n) / BigInt(months);
  return {
    remaining,
    progressBps: Math.min(bps(input.saved, input.target) ?? 0, 10000),
    monthsLeft: months,
    monthlyNeeded: monthly,
    reached: remaining === 0n,
    late: Boolean(
      input.targetDate && input.targetDate < input.today && remaining > 0n,
    ),
  };
}

/**
 * Cash projection month by month: starts from today's cash and adds what is
 * known (recurring income, fixed costs, installments) plus the average of
 * recent variable spending, which is the part nobody schedules.
 */
export function projectCash(
  startCash: bigint,
  months: {
    month: string;
    income: bigint;
    fixed: bigint;
    installments: bigint;
    variableEstimate: bigint;
  }[],
) {
  let cash = startCash;
  return months.map((month) => {
    const balance =
      month.income - month.fixed - month.installments - month.variableEstimate;
    cash += balance;
    return { ...month, balance, projectedCash: cash };
  });
}
