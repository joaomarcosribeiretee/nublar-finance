import { currentLocale, t } from "@/i18n";
import { getSupabase } from "./supabase";

export class ApiError extends Error {}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ApiError(t("common.errors.sessionExpired"));
  }

  const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // The API answers errors in this language; on first sign-in it is
        // also the new user's starting language.
        "Accept-Language": currentLocale(),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(t("common.errors.apiUnreachable"));
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new ApiError(message ?? t("common.errors.generic"));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function errorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : t("common.errors.generic");
}
