import { describe, expect, it } from "vitest";
import { bpsToPercentInput, parsePercentToBps, rateLabel } from "./rates";

describe("fixed income rates", () => {
  it("parses percentages into basis points", () => {
    expect(parsePercentToBps("110")).toBe(11000);
    expect(parsePercentToBps("6,5")).toBe(650);
    expect(parsePercentToBps("12.25%")).toBe(1225);
    expect(parsePercentToBps("abc")).toBeNull();
  });

  it("round-trips the editable form", () => {
    expect(bpsToPercentInput(650)).toBe("6,5");
    expect(bpsToPercentInput(1225)).toBe("12,25");
    expect(bpsToPercentInput(11000)).toBe("110");
  });

  it("reads like the bank writes it", () => {
    expect(rateLabel("CDI", 11000)).toBe("110% do CDI");
    expect(rateLabel("IPCA", 650)).toBe("IPCA + 6,5%");
    expect(rateLabel("PREFIXED", 1200)).toBe("12% a.a.");
    expect(rateLabel("SELIC", 0)).toBe("Selic");
    expect(rateLabel(null, null)).toBeNull();
  });
});
