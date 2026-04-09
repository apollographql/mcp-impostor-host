import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import pluginImport from "eslint-plugin-import";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

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
      // This rule has too many false positives
      "import/no-unresolved": "off",
    },
  },
  {
    ignores: ["**/*.config.{ts,mjs}"],
    rules: {
      "import/extensions": ["error", "always", { ignorePackages: true }],
      "import/order": [
        "warn",
        {
          "newlines-between": "always",
          pathGroups: [
            {
              pattern: "#**",
              group: "internal",
              position: "before",
            },
          ],
          groups: [
            "builtin",
            "external",
            "internal",
            ["sibling", "parent"],
            "index",
          ],
          alphabetize: {
            order: "asc",
            orderImportKind: "asc",
            caseInsensitive: true,
          },
          named: true,
        },
      ],
      "import/newline-after-import": "warn",
      "import/no-default-export": "error",
    },
  },
  {
    ignores: ["dist/**/*"],
  },
]);
