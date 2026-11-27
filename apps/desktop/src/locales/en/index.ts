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

/**
 * Typed as the pt-BR resources, so a key missing in English is a compile
 * error. At runtime anything missing would still fall back to pt-BR.
 */
export const en: typeof ptBR = {
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
