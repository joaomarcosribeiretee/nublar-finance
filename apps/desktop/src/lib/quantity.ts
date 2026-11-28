import { cryptoCoins, satsToBtc, type Locale } from "@nublar/validation";
import { currentLocale } from "@/i18n";
import { typedToSats, type BtcUnit } from "@/lib/bitcoin";
import { numberSeparators } from "@/lib/format";

/**
 * A typed coin quantity as the API takes it: decimal text with ".". Bitcoin
 * can be typed in BTC or sats and goes as BTC (whole sats). Null when it is
 * not a number above zero.
 */
export function typedToQuantity(text: string, coinId: string | null, unit: BtcUnit): string | null {
  const trimmed = text.trim().replace(/[.,]$/, "");
  if (coinId === "bitcoin") {
    const sats = typedToSats(trimmed, unit);
    return sats && sats > 0n ? satsToBtc(sats) : null;
  }
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized) || /^[0.]+$/.test(normalized)) return null;
  return normalized;
}

/** "1234.5" as "1.234,5" in pt-BR and "1,234.5" in en, every decimal kept. */
export function formatQuantity(text: string, locale: Locale = currentLocale()): string {
  const [whole, fraction] = text.split(".");
  const grouped = new Intl.NumberFormat(locale, { useGrouping: true }).format(BigInt(whole || "0"));
  return fraction ? `${grouped}${numberSeparators(locale).decimal}${fraction}` : grouped;
}

/** "BTC" for the coin the position follows, else its ticker; empty when neither. */
export function coinSymbol(coinId: string | null, ticker: string): string {
  return cryptoCoins.find((coin) => coin.id === coinId)?.symbol ?? ticker.trim().toUpperCase();
}
