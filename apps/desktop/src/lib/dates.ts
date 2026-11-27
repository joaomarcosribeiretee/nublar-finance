import type { Locale } from "@nublar/validation";
import { currentLocale, t } from "@/i18n";

/** Month and weekday names come from Intl, in the language being shown. */
function names(locale: Locale, options: Intl.DateTimeFormatOptions, dates: number[]): string[] {
  const format = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  // "set." → "set": pt-BR abbreviations read without the dot in the app.
  return dates.map((date) => format.format(date).replace(".", ""));
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** Full month names, January first: "Janeiro" / "January". */
export function monthNames(locale: Locale = currentLocale()): string[] {
  const months = Array.from({ length: 12 }, (_, month) => Date.UTC(2000, month, 1));
  return names(locale, { month: "long" }, months).map(capitalize);
}

/** Short month names, January first: "jan" / "Jan". */
function shortMonthNames(locale: Locale): string[] {
  const months = Array.from({ length: 12 }, (_, month) => Date.UTC(2000, month, 1));
  return names(locale, { month: "short" }, months);
}

/** Short weekday names, Sunday first: "dom" / "Sun". 2000-01-02 was a Sunday. */
export function weekdayNames(locale: Locale = currentLocale()): string[] {
  const days = Array.from({ length: 7 }, (_, day) => Date.UTC(2000, 0, 2 + day));
  return names(locale, { weekday: "short" }, days);
}

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

/** "Outubro 2026" / "October 2026" */
export function monthLabel(month: string, locale: Locale = currentLocale()): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${monthNames(locale)[monthNumber - 1]} ${year}`;
}

/** "out" / "Oct" */
export function shortMonthLabel(month: string, locale: Locale = currentLocale()): string {
  const [, monthNumber] = month.split("-").map(Number);
  return shortMonthNames(locale)[monthNumber - 1];
}

/** Day and short month in the language's order: "10 out" / "Oct 10". */
function dayAndMonth(day: number, month: number, locale: Locale): string {
  const name = shortMonthNames(locale)[month - 1];
  return locale === "en" ? `${name} ${day}` : `${day} ${name}`;
}

/** "10 out" / "Oct 10" */
export function shortDate(date: string, locale: Locale = currentLocale()): string {
  const [, month, day] = date.split("-").map(Number);
  return dayAndMonth(day, month, locale);
}

/** "Hoje", "Ontem" or "seg, 29 set" / "Today", "Yesterday" or "Mon, Sep 29". */
export function dayLabel(date: string, now = new Date(), locale: Locale = currentLocale()): string {
  const today = todayLocal(now);
  if (date === today) {
    return t("common.dates.today");
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date === todayLocal(yesterday)) {
    return t("common.dates.yesterday");
  }
  const [year, month, day] = date.split("-").map(Number);
  const weekday = weekdayNames(locale)[new Date(year, month - 1, day).getDay()];
  return `${weekday}, ${dayAndMonth(day, month, locale)}`;
}

/** A default date for a new entry: today, or the 1st when browsing another month. */
export function defaultDateFor(month: string, now = new Date()): string {
  return month === currentMonth(now) ? todayLocal(now) : `${month}-01`;
}
