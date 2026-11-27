import { z } from "zod";

export const localeSchema = z.enum(["pt-BR", "en"]);

export type Locale = z.infer<typeof localeSchema>;

export const DEFAULT_LOCALE: Locale = "pt-BR";

/**
 * The supported locale closest to a BCP 47 tag or an Accept-Language header
 * ("pt-PT" → "pt-BR", "en-GB,en;q=0.9" → "en"). Portuguese reads pt-BR; any
 * other language reads English, which more people understand than Portuguese.
 * Without a tag, the default.
 */
export function resolveLocale(tag: string | null | undefined): Locale {
  const first = tag?.split(",")[0]?.split(";")[0]?.trim().toLowerCase();
  if (!first || first === "*") {
    return DEFAULT_LOCALE;
  }
  return first.startsWith("pt") ? "pt-BR" : "en";
}
