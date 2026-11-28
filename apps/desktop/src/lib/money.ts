import type { Locale } from "@nublar/validation";
import { currentLocale } from "@/i18n";
import { formatMinorUnitsNumber, numberSeparators } from "@/lib/format";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Accepts what people type in the language being shown. In pt-BR:
 * "1.234,56", "1234,5", "25" and also "25.90" (a single thousands separator
 * followed by one or two digits is read as decimals). In en the same with the
 * separators swapped: "1,234.56", "25,90".
 */
export function parseReaisToMinorUnits(input: string, locale: Locale = currentLocale()): string | null {
  const { decimal, group } = numberSeparators(locale);
  const groups = new RegExp(escapeRegExp(group), "g");
  let normalized = input.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (normalized.includes(decimal)) {
    normalized = normalized.replace(groups, "").replace(decimal, ".");
  } else if (new RegExp(`^\\d+${escapeRegExp(group)}\\d{1,2}$`).test(normalized)) {
    normalized = normalized.replace(group, ".");
  } else {
    normalized = normalized.replace(groups, "");
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    return null;
  }

  const cents = (match[2] ?? "").padEnd(2, "0");
  const amount = BigInt(match[1] ?? "0") * 100n + BigInt(cents || "0");
  if (amount <= 0n) {
    return null;
  }
  return amount.toString();
}

/** Like parseReaisToMinorUnits, but empty means zero and "-" is allowed. */
export function parseSignedReaisToMinorUnits(input: string, locale: Locale = currentLocale()): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return "0";
  }
  const negative = /^[-−]/.test(trimmed);
  const body = trimmed.replace(/^[-−]\s*/, "");
  if (/^[0.,\s]*$/.test(body.replace(/^R\$/, ""))) {
    return /\d/.test(body) ? "0" : null;
  }
  const parsed = parseReaisToMinorUnits(body, locale);
  if (!parsed) {
    return null;
  }
  return negative ? `-${parsed}` : parsed;
}

/** Minor units back into the editable form ("1.234,56" / "1,234.56"), keeping the sign. */
export function minorUnitsToInput(amount: string, locale: Locale = currentLocale()): string {
  return formatMinorUnitsNumber(amount, locale);
}

/** Share of `part` in `total` as a 0–100 number, for bar widths only. */
export function percentOf(part: string, total: string): number {
  const whole = BigInt(total);
  if (whole <= 0n) {
    return 0;
  }
  return Number((BigInt(part) * 10000n) / whole) / 100;
}
