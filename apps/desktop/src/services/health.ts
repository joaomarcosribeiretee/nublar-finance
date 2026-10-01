import { serviceHealthSchema, type ServiceHealth } from "@nublar/validation";

export async function fetchServiceHealth(): Promise<ServiceHealth | null> {
  const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      return null;
    }

    const parsed = serviceHealthSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
