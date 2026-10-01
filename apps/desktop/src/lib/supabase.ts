import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabaseConfigError(): string | null {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return "Falta a chave do Supabase. Em Project Settings → API, copie a publishable key para VITE_SUPABASE_ANON_KEY e SUPABASE_ANON_KEY.";
  }
  return null;
}

export function getSupabase(): SupabaseClient {
  const configError = supabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );
  }
  return client;
}
