import type { Locale } from "@nublar/validation";
import { currentLocale } from "@/i18n";
import { numberSeparators } from "@/lib/format";

/**
 * Keystroke filters. Each one keeps only what its field can mean, so an
 * invalid character never reaches the screen and parsing at submit time is
 * left with real mistakes (empty, zero) instead of typos.
 */

/** Longest whole part accepted: R$ 999.999.999.999 is beyond any household. */
const MAX_WHOLE_DIGITS = 12;

/**
 * Money as people type it in the language being shown: digits, thousands
 * separators and one decimal separator followed by at most two digits
 * ("1.234,56" in pt-BR, "1,234.56" in en). `signed` keeps a leading minus.
 */
export function sanitizeMoney(
  raw: string,
  { signed = false, locale = currentLocale() }: { signed?: boolean; locale?: Locale } = {},
): string {
  const { decimal, group } = numberSeparators(locale);
  const negative = signed && /^\s*[-−]/.test(raw);
  const body = [...raw].filter((char) => /\d/.test(char) || char === decimal || char === group).join("");
  const separator = body.indexOf(decimal);
  let whole = separator === -1 ? body : body.slice(0, separator);
  let digits = 0;
  whole = [...whole]
    .filter((char) => char === group || ++digits <= MAX_WHOLE_DIGITS)
    .join("");
  // A thousands separator only separates digits: never first, never doubled.
  while (whole.startsWith(group)) whole = whole.slice(group.length);
  whole = whole.split(group).filter((chunk, index, all) => chunk || index === all.length - 1).join(group);
  const text =
    separator === -1
      ? whole
      : `${whole}${decimal}${body.slice(separator + 1).replace(/\D/g, "").slice(0, 2)}`;
  return `${negative ? "-" : ""}${text}`;
}

/**
 * Digits with one decimal separator, e.g. a rate ("6,5" / "6.5") or a quantity.
 * Either "," or "." starts the decimals; the field shows the language's own.
 */
export function sanitizeDecimal(raw: string, decimals = 2, wholeDigits = 9, locale: Locale = currentLocale()): string {
  const body = raw.replace(/[^\d.,]/g, "");
  const separator = body.search(/[.,]/);
  if (separator === -1) {
    return body.slice(0, wholeDigits);
  }
  const whole = body.slice(0, separator).slice(0, wholeDigits);
  const fraction = body.slice(separator + 1).replace(/\D/g, "").slice(0, decimals);
  return `${whole}${numberSeparators(locale).decimal}${fraction}`;
}

/** Digits only. */
export function sanitizeInteger(raw: string, maxDigits = 3): string {
  return raw.replace(/\D/g, "").slice(0, maxDigits);
}

/** Text typed or pasted into an integer field, clamped; empty falls to `min`. */
export function clampInteger(raw: string, min: number, max: number): number {
  const value = Number(sanitizeInteger(raw, 6));
  if (!raw.trim() || Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Names and descriptions: any letter, digit and ordinary punctuation, but no
 * control characters, markup brackets or leading blanks, and no runs of spaces.
 */
export function sanitizeText(raw: string): string {
  return raw
    .replace(/[\p{Cc}<>{}\\]/gu, "")
    .replace(/^\s+/, "")
    .replace(/\s{2,}/g, " ");
}

/** Ticker symbols: "PETR4", "BRK.B", "BTC". */
export function sanitizeTicker(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, "")
    .slice(0, 12);
}

/** An email never has blanks; everything else is left for the browser check. */
export function sanitizeEmail(raw: string): string {
  return raw.replace(/\s/g, "").toLowerCase();
}
