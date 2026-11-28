import { describe, expect, it } from "vitest";
import {
  clampInteger,
  sanitizeDecimal,
  sanitizeEmail,
  sanitizeInteger,
  sanitizeMoney,
  sanitizeText,
  sanitizeTicker,
} from "./input";
import { parseReaisToMinorUnits, parseSignedReaisToMinorUnits } from "./money";

describe("sanitizeMoney", () => {
  it("keeps what people type in Brazil", () => {
    expect(sanitizeMoney("1.234,56")).toBe("1.234,56");
    expect(sanitizeMoney("25")).toBe("25");
    expect(sanitizeMoney("25.90")).toBe("25.90");
    expect(sanitizeMoney("25,")).toBe("25,");
  });

  it("drops letters, symbols and currency prefixes", () => {
    expect(sanitizeMoney("R$ 1.234,56")).toBe("1.234,56");
    expect(sanitizeMoney("12abc3")).toBe("123");
    expect(sanitizeMoney("1e5")).toBe("15");
    expect(sanitizeMoney("+10*2")).toBe("102");
  });

  it("allows one comma and two cents", () => {
    expect(sanitizeMoney("10,999")).toBe("10,99");
    expect(sanitizeMoney("10,5,5")).toBe("10,55");
    expect(sanitizeMoney("10,5.5")).toBe("10,55");
  });

  it("never starts with or doubles a dot", () => {
    expect(sanitizeMoney(".5")).toBe("5");
    expect(sanitizeMoney("1..000")).toBe("1.000");
  });

  it("keeps a minus only when signed", () => {
    expect(sanitizeMoney("-80,00")).toBe("80,00");
    expect(sanitizeMoney("-80,00", { signed: true })).toBe("-80,00");
    expect(sanitizeMoney("−80", { signed: true })).toBe("-80");
    expect(sanitizeMoney("8-0", { signed: true })).toBe("80");
  });

  it("caps the whole part", () => {
    expect(sanitizeMoney("1234567890123456")).toBe("123456789012");
  });

  it("always yields something the parsers accept or reject cleanly", () => {
    expect(parseReaisToMinorUnits(sanitizeMoney("R$ 1.234,56"))).toBe("123456");
    expect(parseReaisToMinorUnits(sanitizeMoney("25.90"))).toBe("2590");
    expect(parseSignedReaisToMinorUnits(sanitizeMoney("-80,5", { signed: true }))).toBe("-8050");
    expect(parseReaisToMinorUnits(sanitizeMoney("abc"))).toBeNull();
  });
});

describe("sanitizeMoney in English", () => {
  it("keeps the comma for thousands and the dot for cents", () => {
    expect(sanitizeMoney("1,234.56", { locale: "en" })).toBe("1,234.56");
    expect(sanitizeMoney("R$ 1,234.567", { locale: "en" })).toBe("1,234.56");
    expect(sanitizeMoney(",5", { locale: "en" })).toBe("5");
    expect(sanitizeMoney("1,,000", { locale: "en" })).toBe("1,000");
    expect(sanitizeMoney("-80.5", { signed: true, locale: "en" })).toBe("-80.5");
    expect(parseReaisToMinorUnits(sanitizeMoney("1,234.56", { locale: "en" }), "en")).toBe("123456");
  });
});

describe("sanitizeDecimal", () => {
  it("keeps digits and one separator, shown as a comma", () => {
    expect(sanitizeDecimal("110")).toBe("110");
    expect(sanitizeDecimal("6,5")).toBe("6,5");
    expect(sanitizeDecimal("12.25")).toBe("12,25");
    expect(sanitizeDecimal("6,555")).toBe("6,55");
    expect(sanitizeDecimal("6%")).toBe("6");
    expect(sanitizeDecimal("0,00012345678", 8)).toBe("0,00012345");
    expect(sanitizeDecimal("6,5", 2, 9, "en")).toBe("6.5");
  });
});

describe("integers", () => {
  it("keeps digits only", () => {
    expect(sanitizeInteger("1a2-3")).toBe("123");
    expect(sanitizeInteger("12345")).toBe("123");
  });

  it("clamps into the range", () => {
    expect(clampInteger("12", 2, 48)).toBe(12);
    expect(clampInteger("1", 2, 48)).toBe(2);
    expect(clampInteger("999", 2, 48)).toBe(48);
    expect(clampInteger("", 2, 48)).toBe(2);
  });
});

describe("text", () => {
  it("removes control characters and markup brackets", () => {
    expect(sanitizeText("Mer\u0000cado <b>")).toBe("Mercado b");
    expect(sanitizeText("  Aluguel")).toBe("Aluguel");
    expect(sanitizeText("Uber  *trip")).toBe("Uber *trip");
  });

  it("keeps accents, digits and ordinary punctuation", () => {
    expect(sanitizeText("Açaí & Cia. 2x (50%)")).toBe("Açaí & Cia. 2x (50%)");
    expect(sanitizeText("Mercado ")).toBe("Mercado ");
  });

  it("normalizes tickers", () => {
    expect(sanitizeTicker("petr4")).toBe("PETR4");
    expect(sanitizeTicker("brk.b!")).toBe("BRK.B");
    expect(sanitizeTicker("ação 3")).toBe("AO3");
  });

  it("strips blanks from emails", () => {
    expect(sanitizeEmail(" Joao@Mail.com ")).toBe("joao@mail.com");
  });
});
