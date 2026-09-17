import tseslint from "typescript-eslint";
import noRawPageOperationsInE2e from "./apps/web/frontend/eslint-rules/no-raw-page-operations-in-e2e.mjs";
import requireE2eFixtureImport from "./apps/web/frontend/eslint-rules/require-e2e-fixture-import.mjs";
import requireE2eLocatorFunctions from "./apps/web/frontend/eslint-rules/require-e2e-locator-functions.mjs";
import requireE2ePageFixture from "./apps/web/frontend/eslint-rules/require-e2e-page-fixture.mjs";
import requireE2ePageObjectMethodReferences from "./apps/web/frontend/eslint-rules/require-e2e-page-object-method-references.mjs";
import requireE2eTestDirectory from "./apps/web/frontend/eslint-rules/require-e2e-test-directory.mjs";

// Acceptance tests live outside every package because they describe the whole
// system, so they are outside the reach of the frontend's ESLint config. They
// are still Playwright tests, and the Page Object conventions that apply to
// apps/web/frontend/e2e apply to them unchanged. The rule implementations are
// shared rather than duplicated; only the file patterns differ.
const local = {
  rules: {
    "no-raw-page-operations-in-e2e": noRawPageOperationsInE2e,
    "require-e2e-fixture-import": requireE2eFixtureImport,
    "require-e2e-locator-functions": requireE2eLocatorFunctions,
    "require-e2e-page-fixture": requireE2ePageFixture,
    "require-e2e-page-object-method-references":
      requireE2ePageObjectMethodReferences,
    "require-e2e-test-directory": requireE2eTestDirectory,
  },
};

export default tseslint.config(
  {
    // Every package lints itself with its own configuration.
    ignores: ["apps/**", "packages/**", "**/node_modules/**"],
  },
  {
    files: ["acceptance/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: { local },
    rules: {
      "local/require-e2e-test-directory": "error",
      "local/require-e2e-fixture-import": "error",
      "local/no-raw-page-operations-in-e2e": "error",
      "local/require-e2e-page-fixture": "error",
    },
  },
  {
    files: ["acceptance/pages/**/*.{ts,tsx}"],
    rules: {
      "local/require-e2e-locator-functions": "error",
      "local/require-e2e-page-object-method-references": "error",
    },
  },
);
