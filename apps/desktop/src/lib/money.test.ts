import { describe, expect, it } from "vitest";
import {
  formatMinorUnits,
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

  it("formats minor units back to reais", () => {
    expect(formatMinorUnits("123456")).toBe("R$ 1.234,56");
    expect(formatMinorUnits("-5000")).toBe("-R$ 50,00");
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
