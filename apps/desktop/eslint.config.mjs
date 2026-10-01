import js from "@eslint/js";
import nublar from "@nublar/eslint-config";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "electron/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nublar,
);
