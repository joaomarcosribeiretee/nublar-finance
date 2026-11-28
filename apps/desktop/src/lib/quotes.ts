import type { Locale } from "@nublar/validation";
import { currentLocale } from "@/i18n";

/**
 * quantity × BRL price in centavos, rounded half up, the same exact math the
 * API uses. Accepts "0,5" or "0.5". Null when either side is not a number.
 */
export function quotedValue(quantity: string, price: string): string | null {
  const parse = (text: string) => {
    const match = /^(\d+)(?:[.,](\d+))?$/.exec(text.trim());
    if (!match) return null;
    const fraction = match[2] ?? "";
    return { digits: BigInt(match[1] + fraction), scale: fraction.length };
  };
  const q = parse(quantity);
  const p = parse(price);
  if (!q || !p) return null;
  const scale = 10n ** BigInt(q.scale + p.scale);
  return ((q.digits * p.digits * 200n + scale) / (scale * 2n)).toString();
}

/**
 * How old a quote is: "há 3 min." / "3 min. ago", in hours or days once
 * older. Null under a minute, which reads better as "agora".
 */
export function formatQuoteAge(fetchedAt: string, now = new Date(), locale: Locale = currentLocale()): string | null {
  const minutes = Math.floor((now.getTime() - new Date(fetchedAt).getTime()) / 60_000);
  if (minutes < 1) return null;
  const format = new Intl.RelativeTimeFormat(locale, { style: "short" });
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  return format.format(-Math.floor(hours / 24), "day");
}
