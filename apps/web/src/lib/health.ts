import type { ServiceHealth } from "@nublar/validation";

export function healthLabel(health: ServiceHealth | null): string {
  if (!health) {
    return "API indisponível";
  }

  if (health.database === "up") {
    return "API e banco conectados";
  }

  return "API no ar, banco indisponível";
}
