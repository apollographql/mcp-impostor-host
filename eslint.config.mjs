import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  tseslint.configs.recommended,
  pluginReactHooks.configs.flat.recommended,
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
]);
