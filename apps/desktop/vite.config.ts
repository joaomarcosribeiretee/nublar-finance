import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Bundle the shared packages from source: Rollup cannot see every named
      // export of their CommonJS build.
      "@nublar/validation": path.resolve(__dirname, "../../packages/validation/src/index.ts"),
      "@nublar/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
  optimizeDeps: {
    include: ["@supabase/supabase-js"],
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
});
