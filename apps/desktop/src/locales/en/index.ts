import type { ptBR } from "@/locales/pt-BR";
import common from "./common.json";
import labels from "./labels.json";
import shell from "./shell.json";
import auth from "./auth.json";
import home from "./home.json";
import transactions from "./transactions.json";
import institutions from "./institutions.json";
import cards from "./cards.json";
import invoices from "./invoices.json";
import investments from "./investments.json";
import planning from "./planning.json";
import recurring from "./recurring.json";
import categories from "./categories.json";
import analytics from "./analytics.json";
import imports from "./imports.json";
import settings from "./settings.json";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * English is filled in by the translation issue. Whatever is missing here
 * falls back to pt-BR, so a partial file never shows a raw key.
 */
export const en: DeepPartial<typeof ptBR> = {
  common,
  labels,
  shell,
  auth,
  home,
  transactions,
  institutions,
  cards,
  invoices,
  investments,
  planning,
  recurring,
  categories,
  analytics,
  imports,
  settings,
};
