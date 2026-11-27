import { t } from "@/i18n";

import type { FixedIncomeProduct } from "./rates";

/**
 * Estimates for CDI-indexed fixed income. These are previews, never stored:
 * the position's value still only changes with manual valuations
 * (docs/decisions/0002). Compounding needs fractional powers, so the math
 * runs in floating point and the result is rounded back to whole cents.
 */

/** Brazilian convention: 252 business days in a year. */
const BUSINESS_DAYS_PER_YEAR = 252;

/** Default CDI (% a.a.) until the user sets their own. */
export const DEFAULT_CDI_BPS = 1490;

const CDI_STORAGE_KEY = "nublar.cdiBps";

export function loadCdiBps(): number {
  try {
    const stored = Number(localStorage.getItem(CDI_STORAGE_KEY));
    return Number.isInteger(stored) && stored > 0 ? stored : DEFAULT_CDI_BPS;
  } catch {
    return DEFAULT_CDI_BPS;
  }
}

export function saveCdiBps(bps: number): void {
  try {
    localStorage.setItem(CDI_STORAGE_KEY, String(bps));
  } catch {
    // Only a convenience: the default is used next time.
  }
}

/** Effective annual rate of "X% do CDI", as a fraction (0.1639 = 16,39% a.a.). */
export function annualRate(cdiBps: number, percentOfCdiBps: number): number {
  return (cdiBps / 10000) * (percentOfCdiBps / 10000);
}

/** Gross gain in minor units after `businessDays`, compounding daily. */
export function grossGain(
  principal: string,
  cdiBps: number,
  percentOfCdiBps: number,
  businessDays: number,
): string {
  const daily = Math.pow(1 + annualRate(cdiBps, percentOfCdiBps), 1 / BUSINESS_DAYS_PER_YEAR) - 1;
  const factor = Math.pow(1 + daily, businessDays) - 1;
  return String(Math.round(Number(principal) * factor));
}

/** Regressive income tax by calendar days held, in basis points. */
export function incomeTaxBps(calendarDays: number): number {
  if (calendarDays <= 180) return 2250;
  if (calendarDays <= 360) return 2000;
  if (calendarDays <= 720) return 1750;
  return 1500;
}

/** Products exempt from income tax for individuals. */
export function isTaxExempt(product: FixedIncomeProduct | null): boolean {
  return product === "LCI" || product === "LCA" || product === "CRI_CRA";
}

export type YieldHorizon = {
  label: string;
  /** Calendar days from today. */
  days: number;
  gross: string;
  net: string;
};

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(Math.round(ms / 86_400_000), 0);
}

/**
 * What the current value would earn over the next month, six months, a
 * year and until maturity. Tax uses the total time held since `startDate`.
 */
export function cdiPreview(input: {
  current: string;
  cdiBps: number;
  percentOfCdiBps: number;
  product: FixedIncomeProduct | null;
  startDate: string;
  maturityDate: string | null;
  today: string;
}): YieldHorizon[] {
  if (input.maturityDate && input.maturityDate <= input.today) {
    return [];
  }
  const untilMaturity = input.maturityDate ? daysBetween(input.today, input.maturityDate) : null;
  // Past maturity the money stops earning this rate.
  const horizons: { label: string; days: number }[] = [
    { label: t("investments.horizons.oneMonth"), days: 30 },
    { label: t("investments.horizons.sixMonths"), days: 182 },
    { label: t("investments.horizons.oneYear"), days: 365 },
  ].filter((horizon) => untilMaturity === null || horizon.days < untilMaturity);
  if (untilMaturity !== null) {
    horizons.push({ label: t("investments.horizons.maturity"), days: untilMaturity });
  }
  const held = daysBetween(input.startDate, input.today);
  const exempt = isTaxExempt(input.product);
  return horizons.map((horizon) => {
      const businessDays = Math.round((horizon.days * BUSINESS_DAYS_PER_YEAR) / 365);
      const gross = BigInt(grossGain(input.current, input.cdiBps, input.percentOfCdiBps, businessDays));
      const tax = exempt ? 0n : (gross * BigInt(incomeTaxBps(held + horizon.days))) / 10000n;
      return { ...horizon, gross: gross.toString(), net: (gross - tax).toString() };
    });
}
