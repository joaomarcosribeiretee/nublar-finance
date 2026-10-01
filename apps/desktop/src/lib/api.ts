import { getSupabase } from "./supabase";

export class ApiError extends Error {}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ApiError("Sessão expirada. Entre de novo.");
  }

  const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("Não foi possível falar com a API. Ela está rodando?");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new ApiError(message ?? "Não foi possível concluir a operação.");
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function errorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : "Não foi possível concluir a operação.";
}
