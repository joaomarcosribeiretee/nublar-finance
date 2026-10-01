import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  optimizeDeps: {
    include: ["@nublar/validation", "@supabase/supabase-js"],
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
});
