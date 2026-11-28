import { describe, expect, it } from "vitest";
import { formatSats, loadBtcUnit, saveBtcUnit, satsToInput, typedToSats } from "./bitcoin";

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("typedToSats", () => {
  it("reads BTC in either decimal separator, exactly", () => {
    expect(typedToSats("0,5", "BTC")).toBe(50_000_000n);
    expect(typedToSats("0.00000001", "BTC")).toBe(1n);
    expect(typedToSats("1", "BTC")).toBe(100_000_000n);
  });

  it("reads sats as whole numbers", () => {
    expect(typedToSats("50000000", "SATS")).toBe(50_000_000n);
    expect(typedToSats(" 1 ", "SATS")).toBe(1n);
  });

  it("is null for less than one sat or anything that is not a number", () => {
    expect(typedToSats("0,000000001", "BTC")).toBeNull();
    expect(typedToSats("1,5", "SATS")).toBeNull();
    expect(typedToSats("", "SATS")).toBeNull();
  });

  it("gives the same sats whichever unit was typed", () => {
    expect(typedToSats("0,0001", "BTC")).toBe(typedToSats("10000", "SATS"));
  });
});

describe("satsToInput", () => {
  it("switches the typed value between units without losing a sat", () => {
    expect(satsToInput(12_345n, "BTC", "pt-BR")).toBe("0,00012345");
    expect(satsToInput(12_345n, "BTC", "en")).toBe("0.00012345");
    expect(satsToInput(12_345n, "SATS", "pt-BR")).toBe("12345");
  });
});

describe("formatSats", () => {
  it("shows BTC and sats in the language's format", () => {
    expect(formatSats(50_000_000n, "BTC", "pt-BR")).toBe("0,5");
    expect(formatSats(150_000_000_000n, "BTC", "pt-BR")).toBe("1.500");
    expect(formatSats(50_000_000n, "SATS", "pt-BR")).toBe("50.000.000");
    expect(formatSats(50_000_000n, "SATS", "en")).toBe("50,000,000");
    expect(formatSats(123_456_789n, "BTC", "en")).toBe("1.23456789");
  });
});

describe("btc unit preference", () => {
  it("starts in BTC and remembers sats", () => {
    const store = memoryStore();
    expect(loadBtcUnit(store)).toBe("BTC");
    saveBtcUnit("SATS", store);
    expect(loadBtcUnit(store)).toBe("SATS");
  });

  it("falls back to BTC when storage fails or holds junk", () => {
    expect(loadBtcUnit(memoryStore({ "nublar.btcUnit": "xyz" }))).toBe("BTC");
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadBtcUnit(broken)).toBe("BTC");
    expect(() => saveBtcUnit("SATS", broken)).not.toThrow();
  });
});
