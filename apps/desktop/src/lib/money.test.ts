import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, setLocale } from "@/i18n";
import {
  minorUnitsToInput,
  parseReaisToMinorUnits,
  parseSignedReaisToMinorUnits,
  percentOf,
} from "./money";

describe("money formatting", () => {
  it("converts a Brazilian amount into minor units", () => {
    expect(parseReaisToMinorUnits("1.234,56")).toBe("123456");
    expect(parseReaisToMinorUnits("R$ 25,9")).toBe("2590");
    expect(parseReaisToMinorUnits("40")).toBe("4000");
  });

  it("reads a single dot with cents as decimals, not thousands", () => {
    expect(parseReaisToMinorUnits("25.90")).toBe("2590");
    expect(parseReaisToMinorUnits("1.500")).toBe("150000");
  });

  it("rejects a zero or malformed amount", () => {
    expect(parseReaisToMinorUnits("0,00")).toBeNull();
    expect(parseReaisToMinorUnits("12,345")).toBeNull();
    expect(parseReaisToMinorUnits("abc")).toBeNull();
  });

  it("round-trips the editable form", () => {
    expect(minorUnitsToInput("123456")).toBe("1.234,56");
    expect(parseReaisToMinorUnits(minorUnitsToInput("1531000"))).toBe("1531000");
    expect(parseReaisToMinorUnits(minorUnitsToInput("705"))).toBe("705");
  });

  it("accepts zero and negative opening balances", () => {
    expect(parseSignedReaisToMinorUnits("")).toBe("0");
    expect(parseSignedReaisToMinorUnits("0,00")).toBe("0");
    expect(parseSignedReaisToMinorUnits("-150,00")).toBe("-15000");
    expect(parseSignedReaisToMinorUnits("1.200")).toBe("120000");
    expect(parseSignedReaisToMinorUnits("abc")).toBeNull();
    expect(minorUnitsToInput("-15000")).toBe("-150,00");
  });

  it("computes bar shares without floats on the amounts", () => {
    expect(percentOf("2500", "10000")).toBe(25);
    expect(percentOf("1", "0")).toBe(0);
  });
});

describe("amounts typed in English", () => {
  afterEach(() => setLocale(DEFAULT_LOCALE));

  it("reads the dot as decimals and the comma as thousands", () => {
    expect(parseReaisToMinorUnits("1,234.56", "en")).toBe("123456");
    expect(parseReaisToMinorUnits("25.9", "en")).toBe("2590");
    expect(parseReaisToMinorUnits("1,500", "en")).toBe("150000");
    expect(parseReaisToMinorUnits("25,90", "en")).toBe("2590");
    expect(parseReaisToMinorUnits("12.345", "en")).toBeNull();
  });

  it("round-trips the editable form in the language being shown", () => {
    setLocale("en");
    expect(minorUnitsToInput("123456")).toBe("1,234.56");
    expect(parseReaisToMinorUnits(minorUnitsToInput("1531000"))).toBe("1531000");
    expect(parseSignedReaisToMinorUnits("-1,250.00")).toBe("-125000");
  });
});
