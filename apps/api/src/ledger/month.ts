/** Shifts a YYYY-MM month by whole months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/** Half-open UTC range [first day of month, first day of next month). */
export function monthRange(month: string): { gte: Date; lt: Date } {
  return {
    gte: new Date(`${month}-01T00:00:00.000Z`),
    lt: new Date(`${shiftMonth(month, 1)}-01T00:00:00.000Z`),
  };
}
