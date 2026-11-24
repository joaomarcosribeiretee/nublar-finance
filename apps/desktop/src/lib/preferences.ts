import {
  DEFAULT_PREFERENCES,
  updatePreferencesSchema,
  type Preferences,
  type Theme,
} from "@nublar/validation";
import { setLocale } from "@/i18n";

/**
 * Local copy of the last preferences the API returned, so theme and language
 * apply before the first request. index.html reads the same key to paint the
 * right theme before the app loads.
 */
export const PREFERENCES_STORAGE_KEY = "nublar.preferences";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** Whatever still parses is kept; anything missing or broken gets its default. */
export function readCachedPreferences(
  storage: KeyValueStore = localStorage,
): Preferences {
  try {
    const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
    const parsed = updatePreferencesSchema.safeParse(raw ? JSON.parse(raw) : {});
    return parsed.success ? { ...DEFAULT_PREFERENCES, ...parsed.data } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function cachePreferences(
  preferences: Preferences,
  storage: KeyValueStore = localStorage,
): void {
  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Only a convenience: the API is the source of truth.
  }
}

export function resolveTheme(theme: Theme, prefersLight: boolean): "dark" | "light" {
  if (theme === "SYSTEM") {
    return prefersLight ? "light" : "dark";
  }
  return theme === "LIGHT" ? "light" : "dark";
}

const lightQuery = "(prefers-color-scheme: light)";

/** What Electron's nativeTheme.themeSource expects for each choice. */
export function nativeThemeSource(theme: Theme): "dark" | "light" | "system" {
  return theme === "SYSTEM" ? "system" : theme === "LIGHT" ? "light" : "dark";
}

export function applyPreferences(preferences: Preferences): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(preferences.theme, matchMedia(lightQuery).matches);
  root.lang = preferences.locale;
  setLocale(preferences.locale);
  // Title bar and native menus (Electron only).
  window.nublar?.setTheme(nativeThemeSource(preferences.theme));
}

/** With theme SYSTEM, follow the OS when it switches while the app is open. */
export function followSystemTheme(): void {
  matchMedia(lightQuery).addEventListener("change", () => {
    const cached = readCachedPreferences();
    if (cached.theme === "SYSTEM") {
      applyPreferences(cached);
    }
  });
}
