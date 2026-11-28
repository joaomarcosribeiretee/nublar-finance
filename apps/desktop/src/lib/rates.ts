import type { Locale } from "@nublar/validation";
import { currentLocale, t, type TranslationKey } from "@/i18n";
import { numberSeparators } from "@/lib/format";

export type Indexer = "CDI" | "IPCA" | "PREFIXED" | "SELIC";
export type Liquidity = "DAILY" | "AT_MATURITY";
export type FixedIncomeProduct =
  | "CDB"
  | "LCI"
  | "LCA"
  | "TESOURO_SELIC"
  | "TESOURO_IPCA"
  | "TESOURO_PREFIXADO"
  | "DEBENTURE"
  | "CRI_CRA"
  | "FUND"
  | "OTHER";

/** Translation keys; render with `t(productLabels[product])`. */
export const productLabels = {
  CDB: "labels.product.CDB",
  LCI: "labels.product.LCI",
  LCA: "labels.product.LCA",
  TESOURO_SELIC: "labels.product.TESOURO_SELIC",
  TESOURO_IPCA: "labels.product.TESOURO_IPCA",
  TESOURO_PREFIXADO: "labels.product.TESOURO_PREFIXADO",
  DEBENTURE: "labels.product.DEBENTURE",
  CRI_CRA: "labels.product.CRI_CRA",
  FUND: "labels.product.FUND",
  OTHER: "labels.product.OTHER",
} as const satisfies Record<FixedIncomeProduct, TranslationKey>;

/** What each product usually pays, to pre-fill the form. */
export const productDefaults: Partial<Record<FixedIncomeProduct, { indexer: Indexer; liquidity?: Liquidity }>> = {
  CDB: { indexer: "CDI" },
  LCI: { indexer: "CDI", liquidity: "AT_MATURITY" },
  LCA: { indexer: "CDI", liquidity: "AT_MATURITY" },
  TESOURO_SELIC: { indexer: "SELIC", liquidity: "DAILY" },
  TESOURO_IPCA: { indexer: "IPCA" },
  TESOURO_PREFIXADO: { indexer: "PREFIXED" },
  DEBENTURE: { indexer: "IPCA", liquidity: "AT_MATURITY" },
  CRI_CRA: { indexer: "IPCA", liquidity: "AT_MATURITY" },
  FUND: { indexer: "CDI", liquidity: "DAILY" },
};

export const indexerLabels = {
  CDI: "labels.indexer.CDI",
  IPCA: "labels.indexer.IPCA",
  PREFIXED: "labels.indexer.PREFIXED",
  SELIC: "labels.indexer.SELIC",
} as const satisfies Record<Indexer, TranslationKey>;

export const liquidityLabels = {
  DAILY: "labels.liquidity.DAILY",
  AT_MATURITY: "labels.liquidity.AT_MATURITY",
} as const satisfies Record<Liquidity, TranslationKey>;

/** "110" → 11000, "6,5" → 650, "12.25" → 1225. No floats involved. */
export function parsePercentToBps(input: string): number | null {
  const match = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(input.trim().replace("%", "").trim());
  if (!match) {
    return null;
  }
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** 650 → "6,5" (pt-BR) / "6.5" (en); 11000 → "110". */
export function bpsToPercentInput(bps: number, locale: Locale = currentLocale()): string {
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  if (fraction === 0) return String(whole);
  return `${whole}${numberSeparators(locale).decimal}${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}

/** "110% do CDI", "IPCA + 6,5%", "12% a.a.", "Selic + 0,1%" or "Selic". */
export function rateLabel(indexer: Indexer | null, rateBps: number | null): string | null {
  if (!indexer) return null;
  const rate = rateBps === null ? null : bpsToPercentInput(rateBps);
  switch (indexer) {
    case "CDI":
      return rate ? t("labels.rate.cdi", { rate }) : "CDI";
    case "IPCA":
      return rate ? t("labels.rate.ipca", { rate }) : "IPCA";
    case "PREFIXED":
      return rate ? t("labels.rate.prefixed", { rate }) : t("labels.indexer.PREFIXED");
    case "SELIC":
      return rate && rateBps ? t("labels.rate.selic", { rate }) : "Selic";
  }
}
