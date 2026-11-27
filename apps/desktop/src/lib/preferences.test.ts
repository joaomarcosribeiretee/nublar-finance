import { DEFAULT_PREFERENCES } from "@nublar/validation";
import { describe, expect, it } from "vitest";
import {
  cachePreferences,
  nativeThemeSource,
  PREFERENCES_STORAGE_KEY,
  readCachedPreferences,
  resolveTheme,
} from "./preferences";

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(PREFERENCES_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("readCachedPreferences", () => {
  it("uses the defaults when nothing is cached", () => {
    expect(readCachedPreferences(memoryStorage(), "pt-BR")).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips what was cached", () => {
    const storage = memoryStorage();
    const saved = { ...DEFAULT_PREFERENCES, theme: "LIGHT" as const, locale: "en" as const };
    cachePreferences(saved, storage);
    expect(readCachedPreferences(storage, "pt-BR")).toEqual(saved);
  });

  it("fills fields an older cache does not have", () => {
    expect(readCachedPreferences(memoryStorage('{"theme":"SYSTEM"}'), "pt-BR")).toEqual({
      ...DEFAULT_PREFERENCES,
      theme: "SYSTEM",
    });
  });

  it("starts in the system language when nothing is saved", () => {
    expect(readCachedPreferences(memoryStorage(), "en").locale).toBe("en");
    expect(readCachedPreferences(memoryStorage('{"theme":"LIGHT"}'), "en")).toEqual({
      ...DEFAULT_PREFERENCES,
      theme: "LIGHT",
      locale: "en",
    });
  });

  it("keeps a saved language over the system one", () => {
    expect(readCachedPreferences(memoryStorage('{"locale":"pt-BR"}'), "en").locale).toBe("pt-BR");
  });

  it("ignores a broken cache", () => {
    expect(readCachedPreferences(memoryStorage("{not json"), "pt-BR")).toEqual(DEFAULT_PREFERENCES);
    expect(readCachedPreferences(memoryStorage('{"theme":"PINK"}'), "pt-BR")).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("resolveTheme", () => {
  it("keeps an explicit choice regardless of the OS", () => {
    expect(resolveTheme("DARK", true)).toBe("dark");
    expect(resolveTheme("LIGHT", false)).toBe("light");
  });

  it("follows the OS on SYSTEM", () => {
    expect(resolveTheme("SYSTEM", true)).toBe("light");
    expect(resolveTheme("SYSTEM", false)).toBe("dark");
  });
});

describe("nativeThemeSource", () => {
  it("maps each choice to Electron's themeSource", () => {
    expect(nativeThemeSource("DARK")).toBe("dark");
    expect(nativeThemeSource("LIGHT")).toBe("light");
    expect(nativeThemeSource("SYSTEM")).toBe("system");
  });
});
