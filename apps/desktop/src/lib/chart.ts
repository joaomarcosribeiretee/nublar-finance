/**
 * Chart helpers. Plotting libraries need numbers, so minor units become reais
 * here for geometry only. Every number a person reads is formatted from the
 * exact minor-unit string instead.
 */
export function plotValue(minorUnits: string): number {
  return Number(BigInt(minorUnits)) / 100;
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
