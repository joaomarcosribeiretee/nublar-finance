import { createContext, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { resolveLocale } from "@nublar/validation";
import { formatMoney } from "@/lib/format";

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
  const { i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  return useCallback((amount: string) => formatMoney(amount, hidden, locale), [hidden, locale]);
}
