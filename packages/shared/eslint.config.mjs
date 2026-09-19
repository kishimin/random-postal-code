import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import { createBaseConfig } from "../../eslint.config.base.mjs";

export default defineConfig([
  globalIgnores(["coverage/**"]),
  ...createBaseConfig({
    tsconfigRootDir: import.meta.dirname,
    oxlintConfigPath: fileURLToPath(
      new URL("./.oxlintrc.json", import.meta.url),
    ),
  }),
]);
