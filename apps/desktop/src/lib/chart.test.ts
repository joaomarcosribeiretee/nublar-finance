import { describe, expect, it } from "vitest";
import { plotValue } from "./chart";

describe("chart helpers", () => {
  it("plots minor units as reais", () => {
    expect(plotValue("123456")).toBe(1234.56);
    expect(plotValue("-5000")).toBe(-50);
  });

});
