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

export const productLabels: Record<FixedIncomeProduct, string> = {
  CDB: "CDB",
  LCI: "LCI",
  LCA: "LCA",
  TESOURO_SELIC: "Tesouro Selic",
  TESOURO_IPCA: "Tesouro IPCA+",
  TESOURO_PREFIXADO: "Tesouro Prefixado",
  DEBENTURE: "Debênture",
  CRI_CRA: "CRI / CRA",
  FUND: "Fundo de renda fixa",
  OTHER: "Outro",
};

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

export const indexerLabels: Record<Indexer, string> = {
  CDI: "% do CDI",
  IPCA: "IPCA +",
  PREFIXED: "Prefixado",
  SELIC: "Selic +",
};

export const liquidityLabels: Record<Liquidity, string> = {
  DAILY: "Liquidez diária",
  AT_MATURITY: "No vencimento",
};

/** "110" → 11000, "6,5" → 650, "12.25" → 1225. No floats involved. */
export function parsePercentToBps(input: string): number | null {
  const match = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(input.trim().replace("%", "").trim());
  if (!match) {
    return null;
  }
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** 650 → "6,5"; 11000 → "110". */
export function bpsToPercentInput(bps: number): string {
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  if (fraction === 0) return String(whole);
  return `${whole},${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}

/** "110% do CDI", "IPCA + 6,5%", "12% a.a.", "Selic + 0,1%" or "Selic". */
export function rateLabel(indexer: Indexer | null, rateBps: number | null): string | null {
  if (!indexer) return null;
  const rate = rateBps === null ? null : bpsToPercentInput(rateBps);
  switch (indexer) {
    case "CDI":
      return rate ? `${rate}% do CDI` : "CDI";
    case "IPCA":
      return rate ? `IPCA + ${rate}%` : "IPCA";
    case "PREFIXED":
      return rate ? `${rate}% a.a.` : "Prefixado";
    case "SELIC":
      return rate && rateBps ? `Selic + ${rate}%` : "Selic";
  }
}
