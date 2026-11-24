import { t } from "@/i18n";
import type { ServiceHealth } from "@nublar/validation";

export function healthLabel(health: ServiceHealth | null): string {
  if (!health) {
    return t("common.health.down");
  }

  if (health.database === "up") {
    return t("common.health.up");
  }

  return t("common.health.databaseDown");
}
