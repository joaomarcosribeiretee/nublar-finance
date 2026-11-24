import js from "@eslint/js";
import nublar from "@nublar/eslint-config";
import i18next from "eslint-plugin-i18next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "electron/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nublar,
  {
    // Visible text lives in src/locales: a literal in JSX fails the lint.
    files: ["src/**/*.tsx"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            // Props that never reach the screen as text.
            exclude: [
              "className", "style", "type", "key", "id", "width", "height", "name", "icon", "variant",
              "tone", "size", "role", "href", "target", "rel", "src", "accept", "inputMode", "autoComplete",
              "autoCapitalize", "dataKey", "nameKey", "stroke", "fill", "stopColor", "color", "shape",
              "columns", "layout", "aria-hidden", "aria-current", "aria-live", "aria-keyshortcuts",
              "min", "max", "step", "pattern", "value", "defaultValue", "sign", "mode", "i18nKey",
              "x", "y", "x1", "x2", "y1", "y2", "offset", "strokeDasharray", "cursor", "stackId", "theme",
            ],
          },
          // Option values, colors and other identifiers set inside JSX.
          "object-properties": {
            exclude: ["[A-Z_-]+", "value", "kind", "color", "shape", "stroke", "fill", "activeClass"],
          },
          // State setters and navigation take ids, not text. "t" and the rest keep the plugin defaults.
          callees: {
            exclude: [
              "i18n(ext)?", "t", "require", "addEventListener", "removeEventListener", "postMessage",
              "getElementById", "dispatch", "commit", "includes", "indexOf", "endsWith", "startsWith",
              "set[A-Z][A-Za-z]*", "go", "select",
            ],
          },
          words: {
            // Numbers, punctuation, separators and all-caps codes (OFX, CDI) are not text.
            exclude: ["[0-9!-/:-@[-`{-~ ·•–—−→×%]+", "[A-Z0-9_ .+-]+"],
          },
        },
      ],
    },
  },
);
