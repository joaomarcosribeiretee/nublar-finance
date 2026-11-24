import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WCAG AA in both themes, computed from tokens.css itself so a palette
 * change that loses contrast fails here instead of in someone's eyes.
 */
const css = readFileSync(path.join(__dirname, "tokens.css"), "utf8");

/** The body of the block opened by `selector {`. */
function blockOf(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} block not found`);
  return css.slice(start, css.indexOf("}", start));
}

/** Every custom property a theme block declares. */
function tokenNames(selector: string): string[] {
  return [...blockOf(selector).matchAll(/^\s*--([\w-]+):/gm)].map((m) => m[1]).sort();
}

/** The hex tokens of a theme block, with var() aliases resolved. */
function palette(selector: string): Record<string, string> {
  const block = blockOf(selector);
  const colors: Record<string, string> = Object.fromEntries(
    [...block.matchAll(/^\s*--([\w-]+):\s*(#[0-9a-f]{6});/gim)].map((m) => [m[1], m[2]]),
  );
  for (const [, token, target] of block.matchAll(/^\s*--([\w-]+):\s*var\(--([\w-]+)\);/gm)) {
    if (colors[target]) colors[token] = colors[target];
  }
  return colors;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const surfaces = ["background", "surface", "surface-2", "raised"];
const text = ["foreground", "muted", "faint", "accent", "positive", "negative", "warning", "transfer"];
const series = Array.from({ length: 8 }, (_, i) => `series-${i + 1}`);

const themes = ["dark", "light"].map((name) => {
  const selector = `[data-theme="${name}"]`;
  return [name, selector, palette(selector)] as const;
});

describe.each(themes)("%s theme", (_name, selector, colors) => {
  it("declares the same tokens as the dark theme", () => {
    expect(tokenNames(selector)).toEqual(tokenNames('[data-theme="dark"]'));
  });

  it.each(text)("--%s reads at 4.5:1 on every surface", (token) => {
    for (const surface of surfaces) {
      expect(
        contrast(colors[token], colors[surface]),
        `--${token} on --${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps button text readable on the accent", () => {
    expect(contrast(colors["accent-fg"], colors.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(series)("--%s reaches 3:1 on the chart surface", (token) => {
    expect(contrast(colors[token], colors.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});
