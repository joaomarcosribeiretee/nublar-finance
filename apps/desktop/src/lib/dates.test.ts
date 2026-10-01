import { describe, expect, it } from "vitest";
import { dayLabel, defaultDateFor, shiftMonth, todayLocal } from "./dates";

describe("dates", () => {
  it("uses the local calendar day, not UTC", () => {
    // 22:30 in Brasília is already the next day in UTC.
    const lateEvening = new Date(2026, 9, 1, 22, 30);
    expect(todayLocal(lateEvening)).toBe("2026-10-01");
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("labels recent days in plain words", () => {
    const now = new Date(2026, 9, 1, 10);
    expect(dayLabel("2026-10-01", now)).toBe("Hoje");
    expect(dayLabel("2026-09-30", now)).toBe("Ontem");
    expect(dayLabel("2026-09-28", now)).toBe("seg, 28 set");
  });

  it("defaults new entries into the month being browsed", () => {
    const now = new Date(2026, 9, 15, 10);
    expect(defaultDateFor("2026-10", now)).toBe("2026-10-15");
    expect(defaultDateFor("2026-08", now)).toBe("2026-08-01");
  });
});
