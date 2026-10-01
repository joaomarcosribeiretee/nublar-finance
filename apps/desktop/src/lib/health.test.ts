import { describe, expect, it } from "vitest";
import { healthLabel } from "./health";

describe("healthLabel", () => {
  it("describes a fully connected stack", () => {
    expect(
      healthLabel({
        status: "ok",
        service: "nublar-api",
        database: "up",
      }),
    ).toBe("API e banco conectados");
  });

  it("describes an API running without the database", () => {
    expect(
      healthLabel({
        status: "degraded",
        service: "nublar-api",
        database: "down",
      }),
    ).toBe("API no ar, banco indisponível");
  });

  it("describes an unreachable API", () => {
    expect(healthLabel(null)).toBe("API indisponível");
  });
});
