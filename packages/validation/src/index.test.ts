import { describe, expect, it } from "vitest";
import { moneyAmountSchema, serviceHealthSchema } from "./index";

describe("moneyAmountSchema", () => {
  it("accepts an integer amount in minor units", () => {
    expect(moneyAmountSchema.parse("123456")).toBe(123456n);
  });

  it("rejects a decimal amount", () => {
    expect(moneyAmountSchema.safeParse("1234.56").success).toBe(false);
  });
});

describe("serviceHealthSchema", () => {
  it("accepts the API health contract", () => {
    expect(
      serviceHealthSchema.parse({
        status: "degraded",
        service: "nublar-api",
        database: "down",
      }),
    ).toEqual({
      status: "degraded",
      service: "nublar-api",
      database: "down",
    });
  });
});
