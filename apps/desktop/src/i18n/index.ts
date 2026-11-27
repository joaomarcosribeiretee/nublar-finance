import i18n, { type ParseKeys } from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "@nublar/validation";
import { en } from "@/locales/en";
import { ptBR } from "@/locales/pt-BR";

export { DEFAULT_LOCALE };

/**
 * Every area file (common, home, …) is a top-level key of one namespace, so a
 * single `t` reaches all of them: `t("home.title")`, `t("common.save")`.
 * pt-BR is the source of truth and the fallback for anything missing in en.
 */
export const resources = {
  "pt-BR": { translation: ptBR },
  en: { translation: en },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: Object.keys(resources),
  // Resources are bundled, so init finishes before the first render.
  initAsync: false,
  // React already escapes what it renders.
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLocale(locale: Locale): void {
  if (i18n.language !== locale) {
    void i18n.changeLanguage(locale);
  }
}

/** The language the app is showing now. */
export function currentLocale(): Locale {
  return resolveLocale(i18n.language);
}

/**
 * The computer's language, for a first launch with nothing saved yet:
 * Electron's app.getLocale(), or the browser's language outside Electron.
 */
export function systemLocale(): Locale {
  return resolveLocale(
    (typeof window !== "undefined" ? window.nublar?.locale : undefined) ??
      (typeof navigator !== "undefined" ? navigator.language : undefined),
  );
}

/** For code outside components (labels, toasts, lib helpers). */
export const t = i18n.t.bind(i18n);

export default i18n;

/** Any key of the pt-BR resources, e.g. "home.title". */
export type TranslationKey = ParseKeys;
