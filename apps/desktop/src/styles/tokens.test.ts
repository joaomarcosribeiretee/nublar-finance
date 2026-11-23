import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Colors are picked only in styles/tokens.css. Everything else uses the
 * semantic tokens, so a new theme is one block of CSS, not a hunt through
 * components.
 */
const src = path.resolve(__dirname, "..");

/** Files allowed to hold literal colors, and why. */
const allowed = new Set([
  "styles/tokens.css", // the palette itself
  "lib/institutions.ts", // bank brand colors
  "lib/bankMarks.ts", // bank logos
  "lib/bankIdentity.ts", // ink chosen against a bank's brand color
]);

const hexColor = /#[0-9a-f]{3,8}\b/i;
const functionalColor = /\b(?:rgba?|hsla?|oklch|oklab)\(/;
const tailwindPalette =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|divide|placeholder|caret|decoration)-(?:black|zinc|neutral|slate|gray|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/;
/** The white plate behind bank logos is the one sanctioned palette color. */
const logoPlate = /\bbg-white\b/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function offenders(): string[] {
  const found: string[] = [];
  for (const file of walk(src)) {
    const rel = path.relative(src, file).replaceAll(path.sep, "/");
    if (!/\.(tsx?|css)$/.test(rel) || rel.endsWith(".test.ts") || allowed.has(rel)) {
      continue;
    }
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const code = line.replace(/\/\/.*$|\/\*.*?\*\//g, "");
        const isLogoPlate = rel === "components/InstitutionMark.tsx" && logoPlate.test(code);
        if (
          hexColor.test(code) ||
          functionalColor.test(code) ||
          (tailwindPalette.test(code) && !isLogoPlate)
        ) {
          found.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
  }
  return found;
}

describe("design tokens", () => {
  it("keeps literal colors out of components", () => {
    expect(offenders()).toEqual([]);
  });

  it("defines every color token the Tailwind theme maps", () => {
    const css = readFileSync(path.join(src, "styles/tokens.css"), "utf8");
    const mapped = [...css.matchAll(/--color-[\w-]+:\s*var\((--[\w-]+)\)/g)].map((m) => m[1]);
    expect(mapped.length).toBeGreaterThan(0);
    for (const token of mapped) {
      expect(css, `${token} is mapped but never defined`).toMatch(new RegExp(`^\\s*${token}:`, "m"));
    }
  });
});
