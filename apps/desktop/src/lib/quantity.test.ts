import { describe, expect, it } from "vitest";
import { coinSymbol, formatQuantity, typedToQuantity } from "./quantity";

describe("typedToQuantity", () => {
  it("sends bitcoin as BTC, typed in either unit", () => {
    expect(typedToQuantity("0,25", "bitcoin", "BTC")).toBe("0.25");
    expect(typedToQuantity("25000000", "bitcoin", "SATS")).toBe("0.25");
  });

  it("keeps other coins as decimal text with a dot", () => {
    expect(typedToQuantity("1,5", "ethereum", "BTC")).toBe("1.5");
    expect(typedToQuantity("3,", null, "BTC")).toBe("3");
  });

  it("refuses zero, junk and less than one sat", () => {
    expect(typedToQuantity("0", "ethereum", "BTC")).toBeNull();
    expect(typedToQuantity("0,000", null, "BTC")).toBeNull();
    expect(typedToQuantity("abc", null, "BTC")).toBeNull();
    expect(typedToQuantity("0,000000001", "bitcoin", "BTC")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("follows the language and keeps every decimal", () => {
    expect(formatQuantity("1234.00012", "pt-BR")).toBe("1.234,00012");
    expect(formatQuantity("1234.00012", "en")).toBe("1,234.00012");
    expect(formatQuantity("2", "pt-BR")).toBe("2");
  });
});

describe("coinSymbol", () => {
  it("prefers the quoted coin, then the ticker", () => {
    expect(coinSymbol("bitcoin", "")).toBe("BTC");
    expect(coinSymbol(null, "doge")).toBe("DOGE");
    expect(coinSymbol(null, "")).toBe("");
  });
});
