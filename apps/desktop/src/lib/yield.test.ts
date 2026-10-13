import { describe, expect, it } from "vitest";
import { annualRate, cdiPreview, grossGain, incomeTaxBps } from "./yield";

describe("CDI yield preview", () => {
  it("applies the percentage of CDI to the annual rate", () => {
    expect(annualRate(1490, 11000)).toBeCloseTo(0.1639, 6);
  });

  it("compounds to the annual rate after 252 business days", () => {
    expect(grossGain("10000", 1490, 10000, 252)).toBe("1490");
    expect(grossGain("10000", 1490, 10000, 0)).toBe("0");
  });

  it("uses the regressive income tax table", () => {
    expect(incomeTaxBps(180)).toBe(2250);
    expect(incomeTaxBps(181)).toBe(2000);
    expect(incomeTaxBps(720)).toBe(1750);
    expect(incomeTaxBps(721)).toBe(1500);
  });

  it("shows gross and net per horizon, stopping at maturity", () => {
    const base = {
      current: "10000",
      cdiBps: 1490,
      percentOfCdiBps: 10000,
      startDate: "2026-10-13",
      today: "2026-10-13",
    };
    const cdb = cdiPreview({ ...base, product: "CDB", maturityDate: null });
    expect(cdb.map((h) => h.label)).toEqual(["1 mês", "6 meses", "1 ano"]);
    expect(cdb[2]).toMatchObject({ gross: "1490", net: "1230" });

    const lci = cdiPreview({ ...base, product: "LCI", maturityDate: "2027-01-11" });
    expect(lci.map((h) => h.label)).toEqual(["1 mês", "Até o vencimento"]);
    expect(lci[0].gross).toBe(lci[0].net);

    expect(cdiPreview({ ...base, product: "CDB", maturityDate: "2026-10-01" })).toEqual([]);
  });
});
