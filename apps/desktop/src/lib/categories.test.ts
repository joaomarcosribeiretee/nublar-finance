import { STARTER_CATEGORIES } from "@nublar/validation";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, setLocale } from "@/i18n";
import { categoryLabel } from "./categories";

describe("categoryLabel", () => {
  afterEach(() => setLocale(DEFAULT_LOCALE));

  it("shows starter categories in the current language", () => {
    expect(categoryLabel("Mercado")).toBe("Mercado");
    setLocale("en");
    expect(categoryLabel("Mercado")).toBe("Groceries");
    expect(categoryLabel("Restaurantes e delivery")).toBe("Restaurants and delivery");
  });

  it("keeps the name of a category the user created", () => {
    setLocale("en");
    expect(categoryLabel("Padaria do bairro")).toBe("Padaria do bairro");
  });

  it("translates the API's name for uncategorized entries", () => {
    setLocale("en");
    expect(categoryLabel("Sem categoria")).toBe("No category");
  });

  it("reads every starter category under its stored name in pt-BR", () => {
    for (const category of STARTER_CATEGORIES) {
      expect(categoryLabel(category.name)).toBe(category.name);
    }
  });
});
