import { STARTER_CATEGORIES, type StarterCategoryKey } from "@nublar/validation";
import { t } from "@/i18n";

const starterKeys = new Map<string, StarterCategoryKey>(
  STARTER_CATEGORIES.map((category) => [category.name, category.key]),
);

/** What the API calls entries without a category in its summaries. */
const API_UNCATEGORIZED = "Sem categoria";

/**
 * How a category reads in the current language. The starter categories are
 * stored under their pt-BR name and shown translated; the user's own keep
 * the name they typed. Users cannot rename categories, and a name is unique
 * per user, so a starter name always means the starter category.
 */
export function categoryLabel(name: string): string {
  if (name === API_UNCATEGORIZED) {
    return t("transactions.noCategory");
  }
  const key = starterKeys.get(name);
  return key ? t(`labels.category.${key}`) : name;
}
