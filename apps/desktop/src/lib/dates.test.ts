import { describe, expect, it } from "vitest";
import {
  dayLabel,
  defaultDateFor,
  monthLabel,
  monthNames,
  shiftMonth,
  shortDate,
  shortMonthLabel,
  todayLocal,
  weekdayNames,
} from "./dates";

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

  it("names months and weekdays through Intl in each language", () => {
    expect(monthNames("pt-BR")).toEqual([
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ]);
    expect(monthNames("en")[0]).toBe("January");
    expect(weekdayNames("pt-BR")).toEqual(["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]);
    expect(weekdayNames("en")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("formats months and days in the order of each language", () => {
    expect(monthLabel("2026-10", "pt-BR")).toBe("Outubro 2026");
    expect(monthLabel("2026-10", "en")).toBe("October 2026");
    expect(shortMonthLabel("2026-05", "pt-BR")).toBe("mai");
    expect(shortMonthLabel("2026-09", "en")).toBe("Sep");
    expect(shortDate("2026-10-10", "pt-BR")).toBe("10 out");
    expect(shortDate("2026-10-10", "en")).toBe("Oct 10");
    expect(dayLabel("2026-09-28", new Date(2026, 9, 1, 10), "en")).toBe("Mon, Sep 28");
  });

  it("defaults new entries into the month being browsed", () => {
    const now = new Date(2026, 9, 15, 10);
    expect(defaultDateFor("2026-10", now)).toBe("2026-10-15");
    expect(defaultDateFor("2026-08", now)).toBe("2026-08-01");
  });
});
