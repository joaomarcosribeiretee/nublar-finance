/**
 * Chart helpers. Plotting libraries need numbers, so minor units become reais
 * here for geometry only. Every number a person reads is formatted from the
 * exact minor-unit string instead.
 */
export function plotValue(minorUnits: string): number {
  return Number(BigInt(minorUnits)) / 100;
}

const compact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Axis ticks: "R$ 12,3 mil", "R$ 1,2 mi". */
export function compactBRL(reais: number): string {
  if (Math.abs(reais) < 1000) {
    return `R$ ${Math.round(reais)}`;
  }
  return `R$ ${compact.format(reais)}`;
}

/** Basis points as a percentage: 1234 → "12,3%". */
export function formatBps(bps: number | null, signed = false): string {
  if (bps === null) {
    return "—";
  }
  const value = (bps / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${signed && bps > 0 ? "+" : ""}${value}%`;
}

/**
 * Allocation colors follow the asset, never its rank, so the same class keeps
 * its color on every screen and after any filter.
 */
export const allocationColors: Record<string, string> = {
  CASH: "var(--series-1)",
  FIXED_INCOME: "var(--series-2)",
  STOCK: "var(--series-3)",
  FII: "var(--series-4)",
  ETF: "var(--series-5)",
  CRYPTO: "var(--series-7)",
  OTHER: "var(--series-8)",
};
