/**
 * Calendar arithmetic on "YYYY-MM-DD" and "YYYY-MM" strings. Anything shown
 * to a person is formatted in lib/format.ts.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Today's calendar date in the user's timezone (toISOString would use UTC). */
export function todayLocal(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonth(now = new Date()): string {
  return todayLocal(now).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** A default date for a new entry: today, or the 1st when browsing another month. */
export function defaultDateFor(month: string, now = new Date()): string {
  return month === currentMonth(now) ? todayLocal(now) : `${month}-01`;
}
