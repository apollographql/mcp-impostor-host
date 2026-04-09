import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginImport from "eslint-plugin-import";
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
  pluginImport.flatConfigs.recommended,
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "import/extensions": ["error", "always", { ignorePackages: true }],
      // This rule has too many false positives
      "import/no-unresolved": "off",
    },
  },
]);
