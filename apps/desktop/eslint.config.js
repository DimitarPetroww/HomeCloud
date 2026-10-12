import { node, react } from "@homecloud/config/eslint";
import { defineConfig } from "eslint/config";

const options = { tsconfigRootDir: import.meta.dirname };

export default defineConfig(
  {
    files: ["src/renderer/**"],
    extends: [react({ ...options, vite: true })],
  },
  {
    // Route files export `Route`; autoCodeSplitting moves their components into separate modules for HMR.
    files: ["src/renderer/src/routes/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["src/main/**", "src/preload/**", "src/shared/**", "*.ts", "*.js"],
    extends: [node(options)],
  },
);
