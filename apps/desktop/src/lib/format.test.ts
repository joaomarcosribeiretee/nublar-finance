import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, setLocale } from "@/i18n";
import {
  daysFrom,
  formatCompactMoney,
  formatDate,
  formatMinorUnitsNumber,
  formatMoney,
  formatMonth,
  formatPercent,
  formatRelativeDays,
  HIDDEN_MONEY,
  monthNames,
  numberSeparators,
  weekdayNames,
} from "./format";

afterEach(() => setLocale(DEFAULT_LOCALE));

describe("numbers", () => {
  it("knows each language's separators", () => {
    expect(numberSeparators("pt-BR")).toEqual({ decimal: ",", group: "." });
    expect(numberSeparators("en")).toEqual({ decimal: ".", group: "," });
  });

  it("writes minor units with the language's separators", () => {
    expect(formatMinorUnitsNumber("123456", "pt-BR")).toBe("1.234,56");
    expect(formatMinorUnitsNumber("123456", "en")).toBe("1,234.56");
    expect(formatMinorUnitsNumber("-705", "en")).toBe("-7.05");
  });
});

describe("formatMoney", () => {
  it("keeps BRL in every language, only the separators change", () => {
    expect(formatMoney("123456", false, "pt-BR")).toBe("R$ 1.234,56");
    expect(formatMoney("123456", false, "en")).toBe("R$ 1,234.56");
    expect(formatMoney("-5000", false, "pt-BR")).toBe("-R$ 50,00");
    expect(formatMoney("-5000", false, "en")).toBe("-R$ 50.00");
    expect(formatMoney("0", false, "en")).toBe("R$ 0.00");
  });

  it("never loses precision on huge amounts", () => {
    expect(formatMoney("99999999999999999", false, "pt-BR")).toBe("R$ 999.999.999.999.999,99");
  });

  it("follows the language being shown by default", () => {
    expect(formatMoney("123456")).toBe("R$ 1.234,56");
    setLocale("en");
    expect(formatMoney("123456")).toBe("R$ 1,234.56");
  });

  it("never reveals the amount or its size when hidden", () => {
    expect(formatMoney("5", true)).toBe(HIDDEN_MONEY);
    expect(formatMoney("-999999999", true, "en")).toBe(HIDDEN_MONEY);
  });

  it("compacts axis ticks in each language", () => {
    expect(formatCompactMoney(950, "pt-BR")).toBe("R$ 950");
    expect(formatCompactMoney(12300, "pt-BR")).toMatch(/^R\$ 12,3\s?mil$/);
    expect(formatCompactMoney(1_200_000, "pt-BR")).toMatch(/^R\$ 1,2\s?mi$/);
    expect(formatCompactMoney(12300, "en")).toBe("R$ 12.3K");
  });
});

describe("formatPercent", () => {
  it("formats basis points with the language's decimal separator", () => {
    expect(formatPercent(1234, false, "pt-BR")).toBe("12,3%");
    expect(formatPercent(1234, false, "en")).toBe("12.3%");
    expect(formatPercent(250, true, "pt-BR")).toBe("+2,5%");
    expect(formatPercent(-615, true, "pt-BR")).toBe("-6,2%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("dates", () => {
  const now = new Date(2026, 9, 1, 10);

  it("names months and weekdays through Intl in each language", () => {
    expect(monthNames("pt-BR")).toEqual([
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ]);
    expect(monthNames("en")[0]).toBe("January");
    expect(weekdayNames("pt-BR")).toEqual(["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]);
    expect(weekdayNames("en")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("formats months in each language", () => {
    expect(formatMonth("2026-10", "long", "pt-BR")).toBe("Outubro 2026");
    expect(formatMonth("2026-10", "long", "en")).toBe("October 2026");
    expect(formatMonth("2026-05", "short", "pt-BR")).toBe("mai");
    expect(formatMonth("2026-09", "short", "en")).toBe("Sep");
  });

  it("formats days in the order of each language", () => {
    expect(formatDate("2026-10-10", "short", { locale: "pt-BR" })).toBe("10 out");
    expect(formatDate("2026-10-10", "short", { locale: "en" })).toBe("Oct 10");
    expect(formatDate("2026-09-28", "weekday", { now, locale: "pt-BR" })).toBe("seg, 28 set");
    expect(formatDate("2026-09-28", "weekday", { now, locale: "en" })).toBe("Mon, Sep 28");
  });

  it("labels the days around today in plain words", () => {
    expect(formatDate("2026-10-01", "weekday", { now, locale: "pt-BR" })).toBe("Hoje");
    expect(formatDate("2026-09-30", "weekday", { now, locale: "pt-BR" })).toBe("Ontem");
    expect(formatDate("2026-10-02", "weekday", { now, locale: "pt-BR" })).toBe("Amanhã");
    expect(formatDate("2026-10-01", "weekday", { now, locale: "en" })).toBe("Today");
    expect(formatDate("2026-09-30", "weekday", { now, locale: "en" })).toBe("Yesterday");
  });

  it("counts whole calendar days, whatever the hour", () => {
    expect(daysFrom("2026-10-04", new Date(2026, 9, 1, 23, 59))).toBe(3);
    expect(daysFrom("2026-09-29", new Date(2026, 9, 1, 0, 1))).toBe(-2);
    // Across Brazil's old DST change and a year boundary.
    expect(daysFrom("2027-01-01", new Date(2026, 11, 31, 12))).toBe(1);
  });

  it("writes relative days through Intl.RelativeTimeFormat", () => {
    expect(formatRelativeDays("2026-10-01", now, "pt-BR")).toBe("hoje");
    expect(formatRelativeDays("2026-10-02", now, "pt-BR")).toBe("amanhã");
    expect(formatRelativeDays("2026-10-04", now, "pt-BR")).toBe("em 3 dias");
    expect(formatRelativeDays("2026-09-28", now, "pt-BR")).toBe("há 3 dias");
    expect(formatRelativeDays("2026-10-01", now, "en")).toBe("today");
    expect(formatRelativeDays("2026-10-04", now, "en")).toBe("in 3 days");
    expect(formatRelativeDays("2026-09-28", now, "en")).toBe("3 days ago");
  });
});
