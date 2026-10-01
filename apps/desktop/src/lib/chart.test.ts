import { describe, expect, it } from "vitest";
import { compactBRL, formatBps, plotValue } from "./chart";

describe("chart helpers", () => {
  it("plots minor units as reais", () => {
    expect(plotValue("123456")).toBe(1234.56);
    expect(plotValue("-5000")).toBe(-50);
  });

  it("compacts axis ticks the Brazilian way", () => {
    expect(compactBRL(950)).toBe("R$ 950");
    expect(compactBRL(12300)).toMatch(/^R\$ 12,3\s?mil$/);
    expect(compactBRL(1_200_000)).toMatch(/^R\$ 1,2\s?mi$/);
  });

  it("formats basis points", () => {
    expect(formatBps(1234)).toBe("12,3%");
    expect(formatBps(250, true)).toBe("+2,5%");
    expect(formatBps(-615, true)).toBe("-6,2%");
    expect(formatBps(null)).toBe("—");
  });
});
