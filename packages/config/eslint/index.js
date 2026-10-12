import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * @typedef {object} Options
 * @property {string} tsconfigRootDir Pass `import.meta.dirname` from the package's eslint.config.js.
 */

/** Rules shared by every TypeScript package in the repo. */
function shared({ tsconfigRootDir }) {
  return [
    globalIgnores(["**/dist/", "**/build/", "**/out/", "**/coverage/", "**/*.gen.ts"]),
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        "@typescript-eslint/consistent-type-imports": [
          "error",
          { fixStyle: "inline-type-imports" },
        ],
        "@typescript-eslint/no-import-type-side-effects": "error",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        // node:test's describe/it return promises the runner handles itself.
        "@typescript-eslint/no-floating-promises": [
          "error",
          {
            allowForKnownSafeCalls: [
              { from: "package", package: "node:test", name: ["describe", "it", "test", "suite"] },
            ],
          },
        ],
        eqeqeq: ["error", "always"],
        "no-console": ["warn", { allow: ["warn", "error"] }],
      },
    },
    {
      // Plain JS config files are not part of any tsconfig.
      files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
      extends: [tseslint.configs.disableTypeChecked],
    },
  ];
}

/** Node.js services and scripts (apps/api, apps/device-agent, ...). */
export function node(/** @type {Options} */ options) {
  return defineConfig(shared(options), { languageOptions: { globals: globals.node } }, prettier);
}

/** Plain TypeScript libraries with no runtime assumptions (packages/types, packages/api-client, ...). */
export function library(/** @type {Options} */ options) {
  return defineConfig(shared(options), prettier);
}

/**
 * React code. Set `vite: true` for apps served by Vite so Fast Refresh rules apply;
 * leave it off for Expo/React Native (apps/mobile).
 */
export function react(/** @type {Options & { vite?: boolean }} */ { vite = false, ...options }) {
  return defineConfig(
    shared(options),
    {
      files: ["**/*.{ts,tsx}"],
      extends: [reactHooks.configs.flat["recommended-latest"]],
      languageOptions: { globals: globals.browser },
    },
    vite
      ? {
          files: ["**/*.tsx"],
          extends: [reactRefresh.configs.vite],
        }
      : {},
    prettier,
  );
}
