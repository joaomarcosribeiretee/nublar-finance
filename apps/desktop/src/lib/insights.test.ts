import { describe, expect, it } from "vitest";
import {
  activeSeries,
  averageCumulative,
  cumulativeSpending,
  formatTenths,
  incomeSplit,
  reserveTenths,
} from "./insights";

const point = (month: string, netWorth: string, flow: Partial<{ income: string; expense: string; invested: string; tracked: boolean }> = {}) => ({
  month,
  netWorth,
  tracked: flow.tracked ?? true,
  income: flow.income ?? "0",
  expense: flow.expense ?? "0",
  invested: flow.invested ?? "0",
});

describe("activeSeries", () => {
  it("drops the flat months before anything happened", () => {
    const series = [
      point("2026-07", "88100", { tracked: false }),
      point("2026-08", "88100"),
      point("2026-09", "2500000"),
      point("2026-10", "3000000", { income: "430000" }),
    ];
    expect(activeSeries(series).map((p) => p.month)).toEqual(["2026-09", "2026-10"]);
  });

  it("keeps a month that only had spending", () => {
    const series = [point("2026-08", "100"), point("2026-09", "100", { expense: "50" })];
    expect(activeSeries(series).map((p) => p.month)).toEqual(["2026-09"]);
  });

  it("starts at the first month when it already had activity", () => {
    const series = [point("2026-08", "100", { income: "100" }), point("2026-09", "100")];
    expect(activeSeries(series)).toHaveLength(2);
  });

  it("shows only the latest month when nothing ever moved", () => {
    const series = [point("2026-08", "100"), point("2026-09", "100")];
    expect(activeSeries(series).map((p) => p.month)).toEqual(["2026-09"]);
  });
});

describe("cumulativeSpending", () => {
  const entry = (date: string, amount: string, extra: Partial<{ type: string; status: string }> = {}) => ({
    type: "EXPENSE",
    status: "POSTED",
    date,
    amount,
    ...extra,
  });

  it("adds up posted expenses day by day", () => {
    const series = cumulativeSpending(
      [
        entry("2026-11-02", "1000"),
        entry("2026-11-02", "500"),
        entry("2026-11-05", "200"),
        entry("2026-11-06", "999", { status: "PENDING" }),
        entry("2026-11-06", "999", { type: "INCOME" }),
        entry("2026-11-06", "999", { type: "TRANSFER" }),
      ],
      "2026-11",
    );
    expect(series).toHaveLength(30);
    expect(series[0]).toBe(0n);
    expect(series[1]).toBe(1500n);
    expect(series[4]).toBe(1700n);
    expect(series[29]).toBe(1700n);
  });

  it("puts an installment bought in an earlier month on day 1", () => {
    expect(cumulativeSpending([entry("2026-09-20", "300")], "2026-11")[0]).toBe(300n);
  });
});

describe("averageCumulative", () => {
  it("averages day by day and stretches shorter months", () => {
    const average = averageCumulative([[100n, 200n], [300n, 400n, 500n]], 3);
    expect(average).toEqual([200n, 300n, 350n]);
  });

  it("ignores months with no spending", () => {
    expect(averageCumulative([[0n, 0n], [100n, 200n]], 2)).toEqual([100n, 200n]);
    expect(averageCumulative([[0n, 0n]], 2)).toBeNull();
  });
});

describe("reserve", () => {
  it("counts months in tenths", () => {
    expect(reserveTenths(1260000n, 300000n)).toBe(42);
    expect(reserveTenths(-5n, 300000n)).toBe(0);
    expect(reserveTenths(100n, 0n)).toBeNull();
  });

  it("formats tenths with a comma", () => {
    expect(formatTenths(42)).toBe("4,2");
    expect(formatTenths(120)).toBe("12");
    expect(formatTenths(5)).toBe("0,5");
  });
});

describe("incomeSplit", () => {
  const month = { income: "10000", fixed: "3000", installments: "1000", variable: "2000", invested: "1000" };

  it("splits income and keeps what was left", () => {
    const split = incomeSplit(month);
    expect(split?.base).toBe(10000n);
    expect(split?.over).toBe(0n);
    expect(split?.parts.map((p) => [p.key, p.amount])).toEqual([
      ["fixed", 3000n],
      ["installments", 1000n],
      ["variable", 2000n],
      ["invested", 1000n],
      ["left", 3000n],
    ]);
  });

  it("switches to the outflow when more left than came in", () => {
    const split = incomeSplit({ ...month, variable: "8000" });
    expect(split?.base).toBe(13000n);
    expect(split?.over).toBe(3000n);
    expect(split?.parts.some((p) => p.key === "left")).toBe(false);
  });

  it("has nothing to say about an empty month", () => {
    expect(incomeSplit({ income: "0", fixed: "0", installments: "0", variable: "0", invested: "0" })).toBeNull();
  });
});
