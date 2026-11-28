import { btcToSats, satsToBtc, SATS_PER_BTC, type Locale } from "@nublar/validation";
import { currentLocale } from "@/i18n";
import { numberSeparators } from "@/lib/format";

/**
 * Bitcoin can be read and typed in BTC or in sats (1 BTC = 100.000.000 sats).
 * The API always stores whole sats; the unit is only how it is shown.
 */
export type BtcUnit = "BTC" | "SATS";

export const BTC_UNIT_STORAGE_KEY = "nublar.btcUnit";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** The unit last chosen on this device; BTC until the person picks sats. */
export function loadBtcUnit(storage: KeyValueStore = localStorage): BtcUnit {
  try {
    return storage.getItem(BTC_UNIT_STORAGE_KEY) === "SATS" ? "SATS" : "BTC";
  } catch {
    return "BTC";
  }
}

export function saveBtcUnit(unit: BtcUnit, storage: KeyValueStore = localStorage): void {
  try {
    storage.setItem(BTC_UNIT_STORAGE_KEY, unit);
  } catch {
    // Only a convenience: the next visit starts in BTC.
  }
}

/** Sats from text typed in either unit ("0,5" BTC or "50.000.000" sats). Null when invalid. */
export function typedToSats(text: string, unit: BtcUnit): bigint | null {
  const trimmed = text.trim();
  if (unit === "BTC") return btcToSats(trimmed);
  // A sat is the smallest unit: whole numbers only.
  return /^\d+$/.test(trimmed) ? BigInt(trimmed) : null;
}

/** 21 million BTC in sats has 16 digits. */
export const MAX_SATS_DIGITS = 16;

/** How the quantity input shows sats in a unit, without thousands separators. */
export function satsToInput(sats: bigint, unit: BtcUnit, locale: Locale = currentLocale()): string {
  if (unit === "SATS") return sats.toString();
  return satsToBtc(sats).replace(".", numberSeparators(locale).decimal);
}

/** "0,5" BTC or "50.000.000" sats, in the language's format. The unit name comes from i18n. */
export function formatSats(sats: bigint, unit: BtcUnit, locale: Locale = currentLocale()): string {
  const group = (value: bigint) => new Intl.NumberFormat(locale, { useGrouping: true }).format(value);
  if (unit === "SATS") return group(sats);
  const fraction = (sats % SATS_PER_BTC).toString().padStart(8, "0").replace(/0+$/, "");
  const whole = group(sats / SATS_PER_BTC);
  return fraction ? `${whole}${numberSeparators(locale).decimal}${fraction}` : whole;
}
