import { createContext, useCallback, useContext } from "react";
import { formatMoney } from "@/lib/money";

/**
 * Privacy mode ("hideValues" in the preferences). The shell provides it once,
 * so every amount on screen reads the same flag without its own request.
 */
export const HideValuesContext = createContext(false);

export function useHideValues(): boolean {
  return useContext(HideValuesContext);
}

/**
 * For amounts that end up inside a string (a sentence, a title, an aria-label).
 * Anywhere else, render <Money>.
 */
export function useFormatMoney(): (amount: string) => string {
  const hidden = useHideValues();
  return useCallback((amount: string) => formatMoney(amount, hidden), [hidden]);
}
