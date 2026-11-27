import { afterEach, describe, expect, it } from "vitest";
import i18n, { DEFAULT_LOCALE, resources, setLocale, t } from "@/i18n";

type Tree = { [key: string]: string | string[] | Tree };

/** "home.title" style paths of every leaf. */
function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "object" && !Array.isArray(value) ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();
}

function valueAt(tree: Tree, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Tree | undefined)?.[key], tree);
}

const ptBR = resources["pt-BR"].translation as unknown as Tree;
const en = resources.en.translation as unknown as Tree;

describe("i18n", () => {
  afterEach(() => setLocale(DEFAULT_LOCALE));

  it("starts in pt-BR and falls back to it", () => {
    expect(i18n.language).toBe("pt-BR");
    expect(i18n.options.fallbackLng).toEqual(["pt-BR"]);
    expect(t("transactions.title")).toBe("Lançamentos");
  });

  it("shows pt-BR for anything English does not have yet", () => {
    setLocale("en");
    expect(i18n.language).toBe("en");
    expect(t("transactions.title")).toBe("Lançamentos");
  });

  it("pluralizes by count", () => {
    expect(t("categories.usage", { count: 1 })).toBe("1 lançamento");
    expect(t("categories.usage", { count: 3 })).toBe("3 lançamentos");
    // pt-BR reads 0 as singular; keys that can be zero say so explicitly.
    expect(t("planning.calendar.items", { count: 0 })).toBe("nada");
    expect(t("planning.calendar.projection.months", { count: 0 })).toBe("0 meses");
    expect(t("planning.calendar.projection.months", { count: 1 })).toBe("1 mês");
  });

  it("fills in values without escaping them (React already does)", () => {
    expect(t("home.categories.open", { name: "Café & Cia" })).toBe("Ver lançamentos de Café & Cia");
  });

  it("has no English key that pt-BR lacks, with the same placeholders", () => {
    for (const key of leaves(en)) {
      const source = valueAt(ptBR, key);
      expect(source, key).toBeDefined();
      const target = valueAt(en, key);
      if (typeof source === "string" && typeof target === "string") {
        expect(placeholders(target), key).toEqual(placeholders(source));
      }
    }
  });

  it("has no empty text in pt-BR", () => {
    for (const key of leaves(ptBR)) {
      const value = valueAt(ptBR, key);
      expect(Array.isArray(value) ? value.length : String(value).trim().length, key).toBeGreaterThan(0);
    }
  });

  it("rejects a key that does not exist at type level", () => {
    // @ts-expect-error: keys are typed from the pt-BR files.
    expect(t("home.doesNotExist")).toBe("home.doesNotExist");
  });
});
