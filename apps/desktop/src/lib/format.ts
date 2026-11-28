import type { Locale } from "@nublar/validation";
import { currentLocale } from "@/i18n";

/**
 * Every number, amount and date a person reads is formatted here, through
 * Intl and in the language being shown. The currency is always BRL: switching
 * the interface to English changes separators and word order, never the money.
 */

/** What privacy mode shows in place of any amount. */
export const HIDDEN_MONEY = "R$ ••••";

const CURRENCY_SYMBOL = "R$";

/** Decimal and thousands separators of a language: "," and "." in pt-BR. */
export function numberSeparators(locale: Locale = currentLocale()): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  return {
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ",",
    group: parts.find((part) => part.type === "group")?.value ?? ".",
  };
}

/** Whole units with thousands separators. BigInt, so no amount loses precision. */
function groupDigits(whole: bigint, locale: Locale): string {
  return new Intl.NumberFormat(locale, { useGrouping: true }).format(whole);
}

/**
 * Minor units as a plain number in the language's format, no symbol:
 * "1.234,56" in pt-BR, "1,234.56" in en. Also the editable form of an amount.
 */
export function formatMinorUnitsNumber(amount: string, locale: Locale = currentLocale()): string {
  const value = BigInt(amount);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const cents = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${groupDigits(absolute / 100n, locale)}${numberSeparators(locale).decimal}${cents}`;
}

/**
 * "R$ 1.234,56" in pt-BR and "R$ 1,234.56" in en; "-R$ 50,00" when negative.
 * The symbol is always followed by a space, as people write reais in both.
 */
export function formatMoney(amount: string, hidden = false, locale: Locale = currentLocale()): string {
  if (hidden) {
    return HIDDEN_MONEY;
  }
  const text = formatMinorUnitsNumber(amount, locale);
  return text.startsWith("-") ? `-${CURRENCY_SYMBOL} ${text.slice(1)}` : `${CURRENCY_SYMBOL} ${text}`;
}

/** Axis ticks: "R$ 12,3 mil" / "R$ 12.3K". Takes reais, since charts plot numbers. */
export function formatCompactMoney(reais: number, locale: Locale = currentLocale()): string {
  if (Math.abs(reais) < 1000) {
    return `${CURRENCY_SYMBOL} ${Math.round(reais)}`;
  }
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  return `${CURRENCY_SYMBOL} ${compact.format(reais)}`;
}

/** Basis points as a percentage: 1234 → "12,3%" / "12.3%"; `signed` adds "+". */
export function formatPercent(bps: number | null, signed = false, locale: Locale = currentLocale()): string {
  if (bps === null) {
    return "—";
  }
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bps / 100);
  return `${signed && bps > 0 ? "+" : ""}${value}%`;
}

/* ---------------------------------------------------------------- dates -- */

/** Month and weekday names come from Intl, in the language being shown. */
function names(locale: Locale, options: Intl.DateTimeFormatOptions, dates: number[]): string[] {
  const format = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  // "set." → "set": pt-BR abbreviations read without the dot in the app.
  return dates.map((date) => format.format(date).replace(".", ""));
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

const monthDates = Array.from({ length: 12 }, (_, month) => Date.UTC(2000, month, 1));

/** Full month names, January first: "Janeiro" / "January". */
export function monthNames(locale: Locale = currentLocale()): string[] {
  return names(locale, { month: "long" }, monthDates).map(capitalize);
}

function shortMonthNames(locale: Locale): string[] {
  return names(locale, { month: "short" }, monthDates);
}

/** Short weekday names, Sunday first: "dom" / "Sun". 2000-01-02 was a Sunday. */
export function weekdayNames(locale: Locale = currentLocale()): string[] {
  const days = Array.from({ length: 7 }, (_, day) => Date.UTC(2000, 0, 2 + day));
  return names(locale, { weekday: "short" }, days);
}

/** A "YYYY-MM": "Outubro 2026" / "October 2026", or "out" / "Oct" when short. */
export function formatMonth(month: string, style: "long" | "short" = "long", locale: Locale = currentLocale()): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return style === "short"
    ? shortMonthNames(locale)[monthNumber - 1]
    : `${monthNames(locale)[monthNumber - 1]} ${year}`;
}

/** Day and short month in the language's order: "10 out" / "Oct 10". */
function dayAndMonth(day: number, month: number, locale: Locale): string {
  const name = shortMonthNames(locale)[month - 1];
  return locale === "en" ? `${name} ${day}` : `${day} ${name}`;
}

function localDay(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Whole calendar days from `now` to `date` (negative in the past). */
export function daysFrom(date: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Rounding absorbs the hour a daylight-saving change adds or removes.
  return Math.round((localDay(date).getTime() - today.getTime()) / 86_400_000);
}

/** "hoje", "amanhã", "em 3 dias", "há 3 dias" / "today", "in 3 days", "3 days ago". */
export function formatRelativeDays(date: string, now = new Date(), locale: Locale = currentLocale()): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(daysFrom(date, now), "day");
}

type DateOptions = { now?: Date; locale?: Locale };

/**
 * A "YYYY-MM-DD" calendar date.
 * - `short`: "10 out" / "Oct 10".
 * - `weekday`: "Hoje", "Ontem", "Amanhã", else "seg, 29 set" / "Mon, Sep 29".
 */
export function formatDate(
  date: string,
  style: "short" | "weekday" = "short",
  { now = new Date(), locale = currentLocale() }: DateOptions = {},
): string {
  const [, month, day] = date.split("-").map(Number);
  if (style === "short") {
    return dayAndMonth(day, month, locale);
  }
  if (Math.abs(daysFrom(date, now)) <= 1) {
    return capitalize(formatRelativeDays(date, now, locale));
  }
  return `${weekdayNames(locale)[localDay(date).getDay()]}, ${dayAndMonth(day, month, locale)}`;
}
