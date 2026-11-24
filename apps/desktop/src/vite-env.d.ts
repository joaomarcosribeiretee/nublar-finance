/// <reference types="vite/client" />

/** The desktop app's version from package.json, set at build time. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface Window {
  nublar: {
    platform: string;
  };
}
