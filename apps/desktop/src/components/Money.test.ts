import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HideValuesContext, useFormatMoney } from "@/hooks/useHideValues";
import { useMoneyChart } from "./charts";
import { Money } from "./Money";

function render(node: ReactNode, hidden: boolean): string {
  return renderToStaticMarkup(createElement(HideValuesContext, { value: hidden }, node));
}

describe("<Money> in privacy mode", () => {
  it("shows the amount normally", () => {
    expect(render(createElement(Money, { amount: "123456" }), false)).toContain("R$ 1.234,56");
  });

  it("masks the amount, keeping the explicit sign", () => {
    const html = render(createElement(Money, { amount: "123456", sign: "-" }), true);
    expect(html).toContain("− R$ ••••");
    expect(html).not.toContain("1.234");
  });

  it("masks amounts inside sentences too", () => {
    function Sentence() {
      return useFormatMoney()("98700");
    }
    expect(render(createElement(Sentence), false)).toBe("R$ 987,00");
    expect(render(createElement(Sentence), true)).toBe("R$ ••••");
  });

  it("hides chart axis labels and tooltips, but keeps the axis width", () => {
    let seen: ReturnType<typeof useMoneyChart> | undefined;
    function Probe() {
      seen = useMoneyChart();
      return null;
    }
    render(createElement(Probe), false);
    expect(seen?.tooltip).toEqual({});
    const visibleWidth = seen?.yAxis.width;

    render(createElement(Probe), true);
    expect(seen?.tooltip).toEqual({ active: false });
    expect(seen?.yAxis.tick).toBe(false);
    expect(seen?.yAxis.width).toBe(visibleWidth);
  });
});

/**
 * Privacy mode only works if every amount goes through <Money> or
 * useFormatMoney. Formatting money straight from a screen would leak it.
 */
describe("amounts go through <Money>", () => {
  const src = path.resolve(__dirname, "..");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });

  it("no screen formats money by itself", () => {
    const offenders = walk(path.join(src, "features"))
      .filter((file) => file.endsWith(".tsx") || (file.endsWith(".ts") && !file.endsWith(".test.ts")))
      .filter((file) => /\bformatMinorUnits\b/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(src, file).replaceAll(path.sep, "/"));
    expect(offenders).toEqual([]);
  });
});
