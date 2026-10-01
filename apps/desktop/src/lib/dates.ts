const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

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

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${monthNames[monthNumber - 1]} ${year}`;
}

export function shortMonthLabel(month: string): string {
  const [, monthNumber] = month.split("-").map(Number);
  return monthNames[monthNumber - 1].slice(0, 3).toLowerCase();
}

/** "10 out" */
export function shortDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day} ${monthNames[month - 1].slice(0, 3).toLowerCase()}`;
}

/** "Hoje", "Ontem" or "seg, 29 set". */
export function dayLabel(date: string, now = new Date()): string {
  const today = todayLocal(now);
  if (date === today) {
    return "Hoje";
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date === todayLocal(yesterday)) {
    return "Ontem";
  }
  const [year, month, day] = date.split("-").map(Number);
  const weekday = weekdays[new Date(year, month - 1, day).getDay()];
  return `${weekday}, ${day} ${shortMonthLabel(date.slice(0, 7))}`;
}

/** A default date for a new entry: today, or the 1st when browsing another month. */
export function defaultDateFor(month: string, now = new Date()): string {
  return month === currentMonth(now) ? todayLocal(now) : `${month}-01`;
}
