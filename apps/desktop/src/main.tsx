import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fraunces/500.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "./i18n";
import { App } from "./App";
import { applyPreferences, followSystemTheme, readCachedPreferences } from "./lib/preferences";
import "./index.css";

// Theme and language before the first screen, sign-in included.
applyPreferences(readCachedPreferences());
followSystemTheme();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
