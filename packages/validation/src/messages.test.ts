import { describe, expect, it } from "vitest";
import {
  createTransactionSchema,
  resolveLocale,
  STARTER_CATEGORIES,
  translateValidationMessage,
  validationMessages,
} from "./index";

describe("resolveLocale", () => {
  it("reads Portuguese as pt-BR and anything else as English", () => {
    expect(resolveLocale("pt-BR")).toBe("pt-BR");
    expect(resolveLocale("pt-PT")).toBe("pt-BR");
    expect(resolveLocale("pt")).toBe("pt-BR");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("es-ES")).toBe("en");
  });

  it("takes the first language of an Accept-Language header", () => {
    expect(resolveLocale("en-GB,en;q=0.9,pt;q=0.8")).toBe("en");
    expect(resolveLocale("pt-BR;q=1, en;q=0.5")).toBe("pt-BR");
  });

  it("falls back to pt-BR without a tag", () => {
    expect(resolveLocale(undefined)).toBe("pt-BR");
    expect(resolveLocale("")).toBe("pt-BR");
    expect(resolveLocale("*")).toBe("pt-BR");
  });
});

describe("validation messages", () => {
  it("has the same keys in every language, none empty", () => {
    const keys = Object.keys(validationMessages["pt-BR"]).sort();
    for (const messages of Object.values(validationMessages)) {
      expect(Object.keys(messages).sort()).toEqual(keys);
      for (const text of Object.values(messages)) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("schemas report a key that translates per language", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      accountId: "4a1c2b8e-1f0e-4c62-9a59-1b2c3d4e5f60",
      amount: "100",
      date: "2026-01-10",
    });
    expect(result.success).toBe(false);
    const message = result.error?.issues[0]?.message ?? "";
    expect(message).toBe("chooseCategory");
    expect(translateValidationMessage(message, "pt-BR")).toBe("Escolha uma categoria");
    expect(translateValidationMessage(message, "en")).toBe("Choose a category");
  });

  it("passes through a message that is not a key", () => {
    expect(translateValidationMessage("Categoria não encontrada", "en")).toBe("Categoria não encontrada");
    expect(translateValidationMessage("toString", "en")).toBe("toString");
  });
});

describe("STARTER_CATEGORIES", () => {
  it("has unique keys and names", () => {
    const keys = STARTER_CATEGORIES.map((category) => category.key);
    const names = STARTER_CATEGORIES.map((category) => category.name);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(names).size).toBe(names.length);
  });
});
