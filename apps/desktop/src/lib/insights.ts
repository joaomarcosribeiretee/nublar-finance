/**
 * Derived readings for the analytics screen. Pure functions over minor-unit
 * strings, so every number a person reads stays exact; charts only get
 * `plotValue` of these.
 */

type WorthPoint = {
  month: string;
  tracked: boolean;
  income: string;
  expense: string;
  invested: string;
  netWorth: string;
};

/**
 * Drops the months before the user started: not tracked, or still sitting
 * flat at the opening balance with nothing coming in or going out. Those
 * months are unknown, not zero, and plotting them invents a jump.
 */
export function activeSeries<T extends WorthPoint>(series: T[]): T[] {
  const start = series.findIndex(
    (point, index) =>
      point.tracked &&
      (point.income !== "0" ||
        point.expense !== "0" ||
        point.invested !== "0" ||
        (index > 0 && point.netWorth !== series[index - 1].netWorth)),
  );
  // Starting on the month that already holds the new balance, not the one
  // before it, keeps the "everything got registered" jump off the curve.
  return start === -1 ? series.slice(-1) : series.slice(start);
}

type PaceEntry = { type: string; status: string; amount: string; date: string };

/**
 * Money spent up to each day of `month` (index 0 = day 1). Only what really
 * happened counts; an expense dated before the month (a card installment)
 * lands on day 1, because it was already owed when the month began.
 */
export function cumulativeSpending(entries: PaceEntry[], month: string): bigint[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const perDay = Array.from({ length: days }, () => 0n);
  for (const entry of entries) {
    if (entry.type !== "EXPENSE" || entry.status !== "POSTED") {
      continue;
    }
    const day = entry.date.slice(0, 7) < month ? 1 : Math.min(Number(entry.date.slice(8, 10)), days);
    perDay[day - 1] += BigInt(entry.amount);
  }
  let total = 0n;
  return perDay.map((value) => (total += value));
}

/**
 * Day-by-day average of earlier months' cumulative spending. A shorter month
 * repeats its last day, so day 31 compares with "the whole month" there too.
 * Months with no spending at all are not history, they are absence.
 */
export function averageCumulative(months: bigint[][], days: number): bigint[] | null {
  const used = months.filter((series) => series.length > 0 && series[series.length - 1] > 0n);
  if (used.length === 0) {
    return null;
  }
  return Array.from({ length: days }, (_, index) => {
    const sum = used.reduce((total, series) => total + series[Math.min(index, series.length - 1)], 0n);
    return sum / BigInt(used.length);
  });
}

/**
 * How many months the money you can reach today would cover at the usual
 * spending, in tenths (42 = 4,2 meses). Null when there is no spending yet.
 */
export function reserveTenths(available: bigint, monthlyExpense: bigint): number | null {
  if (monthlyExpense <= 0n) {
    return null;
  }
  if (available <= 0n) {
    return 0;
  }
  return Number((available * 10n) / monthlyExpense);
}

/** 42 → "4,2"; 120 → "12". */
export function formatTenths(tenths: number): string {
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10;
  return fraction === 0 ? String(whole) : `${whole},${fraction}`;
}

export type SplitPart = { key: "fixed" | "installments" | "variable" | "invested" | "left"; amount: bigint };

/**
 * Where a month's income went, in the order money leaves: fixed bills,
 * installments, everyday spending, investing, and what stayed in the
 * account. `over` is how much left beyond what came in; when it is positive
 * there is nothing left over and the parts add up to the outflow instead.
 */
export function incomeSplit(point: {
  income: string;
  fixed: string;
  installments: string;
  variable: string;
  invested: string;
}): { base: bigint; parts: SplitPart[]; over: bigint } | null {
  const income = BigInt(point.income);
  const spent: SplitPart[] = [
    { key: "fixed", amount: BigInt(point.fixed) },
    { key: "installments", amount: BigInt(point.installments) },
    { key: "variable", amount: BigInt(point.variable) },
    { key: "invested", amount: BigInt(point.invested) },
  ];
  const out = spent.reduce((total, part) => total + part.amount, 0n);
  if (income <= 0n && out <= 0n) {
    return null;
  }
  const left = income - out;
  return {
    base: left >= 0n ? income : out,
    parts: [...spent, { key: "left" as const, amount: left > 0n ? left : 0n }].filter((part) => part.amount > 0n),
    over: left < 0n ? -left : 0n,
  };
}
