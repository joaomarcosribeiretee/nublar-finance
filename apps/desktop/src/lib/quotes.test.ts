import { describe, expect, it } from "vitest";
import { formatQuoteAge, quotedValue } from "./quotes";

describe("quotedValue", () => {
  it("multiplies quantity by price in centavos without floats", () => {
    expect(quotedValue("0,5", "512345.12")).toBe("25617256");
    expect(quotedValue("0.00012345", "512345.12345678")).toBe("6325");
    expect(quotedValue("1", "0.005")).toBe("1");
  });

  it("is null for anything that is not a number", () => {
    expect(quotedValue("", "10")).toBeNull();
    expect(quotedValue("1", "abc")).toBeNull();
  });
});

describe("formatQuoteAge", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("is null under a minute", () => {
    expect(formatQuoteAge(ago(30_000), now, "pt-BR")).toBeNull();
  });

  it("says how many minutes, hours or days ago", () => {
    expect(formatQuoteAge(ago(3 * 60_000), now, "pt-BR")).toBe("há 3 min.");
    expect(formatQuoteAge(ago(3 * 60_000), now, "en")).toBe("3 min. ago");
    expect(formatQuoteAge(ago(2 * 3_600_000), now, "pt-BR")).toBe("há 2 h");
    expect(formatQuoteAge(ago(50 * 3_600_000), now, "en")).toBe("2 days ago");
  });
});
