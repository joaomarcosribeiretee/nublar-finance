import { DEFAULT_PREFERENCES } from "@nublar/validation";
import { describe, expect, it } from "vitest";
import {
  cachePreferences,
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
    expect(readCachedPreferences(memoryStorage())).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips what was cached", () => {
    const storage = memoryStorage();
    const saved = { ...DEFAULT_PREFERENCES, theme: "LIGHT" as const, locale: "en" as const };
    cachePreferences(saved, storage);
    expect(readCachedPreferences(storage)).toEqual(saved);
  });

  it("fills fields an older cache does not have", () => {
    expect(readCachedPreferences(memoryStorage('{"theme":"SYSTEM"}'))).toEqual({
      ...DEFAULT_PREFERENCES,
      theme: "SYSTEM",
    });
  });

  it("ignores a broken cache", () => {
    expect(readCachedPreferences(memoryStorage("{not json"))).toEqual(DEFAULT_PREFERENCES);
    expect(readCachedPreferences(memoryStorage('{"theme":"PINK"}'))).toEqual(DEFAULT_PREFERENCES);
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
