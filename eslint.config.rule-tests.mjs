import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint, RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import limitPropsKeys from "./apps/web/frontend/eslint-rules/limit-props-keys.mjs";
import noRawPageOperationsInE2e from "./apps/web/frontend/eslint-rules/no-raw-page-operations-in-e2e.mjs";
import preferNamedExportsInUtils from "./apps/web/frontend/eslint-rules/prefer-named-exports-in-utils.mjs";
import preferObjectDerivedUnion from "./apps/web/frontend/eslint-rules/prefer-object-derived-union.mjs";
import requireE2eFixtureImport from "./apps/web/frontend/eslint-rules/require-e2e-fixture-import.mjs";
import requireE2eLocatorFunctions from "./apps/web/frontend/eslint-rules/require-e2e-locator-functions.mjs";
import requireE2ePageFixture from "./apps/web/frontend/eslint-rules/require-e2e-page-fixture.mjs";
import requireE2ePageObjectMethodReferences from "./apps/web/frontend/eslint-rules/require-e2e-page-object-method-references.mjs";
import requireE2eTestDirectory from "./apps/web/frontend/eslint-rules/require-e2e-test-directory.mjs";

const repositoryRoot = fileURLToPath(new URL("./", import.meta.url));
const frontendRoot = path.join(repositoryRoot, "apps", "web", "frontend");

// Rule behavior is verified through RuleTester rather than the project config,
// because the frontend config lints with type information and would reject a
// fixture path that has no file on disk. Wiring — which rule is enabled for
// which path — is asserted separately below against the real configs.
const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const run = (name, rule, cases) => {
  test(name, () => {
    ruleTester.run(name, rule, cases);
  });
};

run("limit-props-keys", limitPropsKeys, {
  valid: [
    {
      filename: "src/features/postal-generator/components/AddressList.tsx",
      code: `type AddressListProps = {
  addresses: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  isLoading: boolean;
  emptyLabel: string;
};`,
    },
    {
      // Only Props definitions are limited; other shapes may be wider.
      filename: "src/models/postal-code.ts",
      code: `type PostalCode = {
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
  latitude: number;
  longitude: number;
};`,
    },
  ],
  invalid: [
    {
      filename: "src/features/postal-generator/components/AddressList.tsx",
      code: `type AddressListProps = {
  addresses: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  isLoading: boolean;
  emptyLabel: string;
  headingLevel: number;
};`,
      errors: [{ messageId: "tooManyKeys" }],
    },
    {
      filename: "src/features/history/components/HistoryList.tsx",
      code: `interface HistoryListProps {
  entries: string[];
  maximumEntries: number;
  onSelect: (index: number) => void;
  onClear: () => void;
  isExpanded: boolean;
  emptyLabel: string;
}`,
      errors: [{ messageId: "tooManyKeys" }],
    },
  ],
});

run("prefer-named-exports-in-utils", preferNamedExportsInUtils, {
  valid: [
    {
      filename: "src/utils/format-postal-code.ts",
      code: `export const formatPostalCode = (postalCode) =>
  postalCode.replace(/^(\\d{3})(\\d{4})$/, "$1-$2");`,
    },
    {
      // Views outside utils/ keep their own export convention.
      filename: "src/app/views/App.tsx",
      code: "const App = () => null;\nexport default App;",
    },
  ],
  invalid: [
    {
      filename: "src/utils/format-postal-code.ts",
      code: `const formatPostalCode = (postalCode) => postalCode;
export default formatPostalCode;`,
      errors: [{ messageId: "namedExport" }],
    },
  ],
});

run("prefer-object-derived-union", preferObjectDerivedUnion, {
  valid: [
    {
      filename: "src/features/postal-generator/types/generator-status.ts",
      code: `export const generatorStatuses = {
  idle: "idle",
  loading: "loading",
  success: "success",
  error: "error",
} as const;

export type GeneratorStatus =
  (typeof generatorStatuses)[keyof typeof generatorStatuses];`,
    },
    {
      // A discriminated union of object shapes is not a string literal union.
      filename: "src/features/postal-generator/types/generator-state.ts",
      code: `type GeneratorState =
  | { status: "idle" }
  | { status: "success"; postalCode: string };`,
    },
  ],
  invalid: [
    {
      filename: "src/features/postal-generator/types/generator-status.ts",
      code: `type GeneratorStatus = "idle" | "loading" | "success" | "error";`,
      errors: [{ messageId: "preferObjectDerivedUnion" }],
    },
  ],
});

run("require-e2e-test-directory", requireE2eTestDirectory, {
  valid: [
    {
      filename: "e2e/tests/generate-postal-code.medium.test.ts",
      code: "export {};",
    },
    {
      // Acceptance tests sit directly under the protected acceptance/ root.
      filename: "acceptance/generate-postal-code.large.test.ts",
      code: "export {};",
    },
    {
      // Page Objects are not test files.
      filename: "e2e/pages/generator-page.ts",
      code: "export {};",
    },
    {
      // Outside a browser test directory the rule does not apply.
      filename: "src/utils/format-postal-code.small.test.ts",
      code: "export {};",
    },
  ],
  invalid: [
    {
      filename: "e2e/pages/generate-postal-code.test.ts",
      code: "export {};",
      errors: [{ messageId: "directory" }],
    },
  ],
});

run("require-e2e-fixture-import", requireE2eFixtureImport, {
  valid: [
    {
      filename: "e2e/tests/generate-postal-code.medium.test.ts",
      code: 'import { test } from "../fixtures/test";',
    },
    {
      filename: "acceptance/generate-postal-code.large.test.ts",
      code: 'import { test } from "./fixtures/test";',
    },
    {
      // Importing anything other than `test` is unrestricted.
      filename: "e2e/tests/generate-postal-code.medium.test.ts",
      code: 'import { expect } from "@playwright/test";',
    },
  ],
  invalid: [
    {
      filename: "e2e/tests/generate-postal-code.medium.test.ts",
      code: 'import { test } from "@playwright/test";',
      errors: [{ messageId: "directImport" }],
    },
    {
      filename: "acceptance/generate-postal-code.large.test.ts",
      code: 'import { test } from "@playwright/test";',
      errors: [{ messageId: "directImport" }],
    },
  ],
});

run("no-raw-page-operations-in-e2e", noRawPageOperationsInE2e, {
  valid: [
    {
      filename: "e2e/tests/generate-postal-code.medium.test.ts",
      code: `test("generates a postal code", async ({ generatorPage }) => {
  await generatorPage.generate();
});`,
    },
    {
      // Page Objects are exactly where raw page operations belong.
      filename: "e2e/pages/generator-page.ts",
      code: `export const generatorPage = (page) => {
  const navigate = () => page.goto("/");
  return { navigate };
};`,
    },
  ],
  invalid: [
    {
      filename: "e2e/tests/generate-postal-code.medium.test.ts",
      code: `test("generates a postal code", async ({ page }) => {
  await page.goto("/");
});`,
      errors: [{ messageId: "rawOperation" }],
    },
    {
      // Only the locator call is reported: the chained .click() hangs off a
      // call expression rather than the `page` identifier, so one report per
      // entry point into the page is what this rule produces.
      filename: "acceptance/generate-postal-code.large.test.ts",
      code: `test("generates a postal code", async ({ page }) => {
  await page.getByRole("button").click();
});`,
      errors: [{ messageId: "rawOperation" }],
    },
  ],
});

run("require-e2e-page-fixture", requireE2ePageFixture, {
  valid: [
    {
      filename: "e2e/tests/generate-postal-code.medium.test.ts",
      code: `test("generates a postal code", async ({ generatorPage }) => {
  await generatorPage.generate();
});`,
    },
    {
      // A planned but unimplemented test has no Page Object yet.
      filename: "acceptance/generate-postal-code.large.test.ts",
      code: 'test.skip("generates a postal code", async ({ page }) => {});',
    },
  ],
  invalid: [
    {
      filename: "e2e/tests/generate-postal-code.medium.test.ts",
      code: 'test("generates a postal code", async ({ page }) => {});',
      errors: [{ messageId: "pageFixture" }],
    },
    {
      filename: "acceptance/generate-postal-code.large.test.ts",
      code: 'test("generates a postal code", async () => {});',
      errors: [{ messageId: "pageFixture" }],
    },
  ],
});

run("require-e2e-locator-functions", requireE2eLocatorFunctions, {
  valid: [
    {
      filename: "e2e/pages/generator-page.ts",
      code: `export const generatorPage = (page) => {
  const generateButton = () => page.getByRole("button", { name: /生成/ });
  return { generateButton };
};`,
    },
  ],
  invalid: [
    {
      filename: "e2e/pages/generator-page.ts",
      code: 'const generateButton = page.getByRole("button");',
      errors: [{ messageId: "locator" }],
    },
  ],
});

run(
  "require-e2e-page-object-method-references",
  requireE2ePageObjectMethodReferences,
  {
    valid: [
      {
        filename: "e2e/pages/generator-page.ts",
        code: `export const generatorPage = (page) => {
  const navigate = () => page.goto("/");
  const generate = () => page.getByRole("button").click();
  return { navigate, generate };
};`,
      },
    ],
    invalid: [
      {
        filename: "e2e/pages/generator-page.ts",
        code: `export const generatorPage = (page) => {
  return {
    navigate: () => page.goto("/"),
  };
};`,
        errors: [{ messageId: "method" }],
      },
    ],
  },
);

// Wiring: the rules above only protect the repository if the real configs
// enable them for the right paths. calculateConfigForFile resolves the config
// without parsing, so it works for paths that have no file yet.
const frontendEslint = new ESLint({
  cwd: frontendRoot,
  overrideConfigFile: path.join(frontendRoot, "eslint.config.mjs"),
});

const acceptanceEslint = new ESLint({
  cwd: repositoryRoot,
  overrideConfigFile: path.join(repositoryRoot, "eslint.config.mjs"),
});

const assertRuleEnabled = async (eslint, filePath, ruleId) => {
  const config = await eslint.calculateConfigForFile(filePath);
  const severity = config.rules[ruleId]?.[0];
  assert.equal(
    severity,
    2,
    `${ruleId} must be an error for ${filePath}, got ${JSON.stringify(severity)}`,
  );
};

test("frontend config enables the shared rules for src and e2e", async () => {
  await assertRuleEnabled(
    frontendEslint,
    "src/features/postal-generator/components/AddressList.tsx",
    "local/limit-props-keys",
  );
  await assertRuleEnabled(
    frontendEslint,
    "src/utils/format-postal-code.ts",
    "local/prefer-named-exports-in-utils",
  );
  await assertRuleEnabled(
    frontendEslint,
    "src/features/postal-generator/types/generator-status.ts",
    "local/prefer-object-derived-union",
  );
  await assertRuleEnabled(
    frontendEslint,
    "e2e/tests/generate-postal-code.medium.test.ts",
    "local/no-raw-page-operations-in-e2e",
  );
  await assertRuleEnabled(
    frontendEslint,
    "e2e/pages/generator-page.ts",
    "local/require-e2e-locator-functions",
  );
});

test("root config enables the browser rules for acceptance tests", async () => {
  for (const ruleId of [
    "local/require-e2e-test-directory",
    "local/require-e2e-fixture-import",
    "local/no-raw-page-operations-in-e2e",
    "local/require-e2e-page-fixture",
  ]) {
    await assertRuleEnabled(
      acceptanceEslint,
      "acceptance/generate-postal-code.large.test.ts",
      ruleId,
    );
  }

  await assertRuleEnabled(
    acceptanceEslint,
    "acceptance/pages/generator-page.ts",
    "local/require-e2e-page-object-method-references",
  );
});

test("an acceptance test that bypasses the Page Object is reported", async () => {
  const [result] = await acceptanceEslint.lintText(
    `import { test } from "@playwright/test";

test("generates a postal code", async ({ page }) => {
  await page.goto("/");
});
`,
    { filePath: "acceptance/generate-postal-code.large.test.ts" },
  );

  assert.deepEqual(result.messages.map(({ ruleId }) => ruleId).sort(), [
    "local/no-raw-page-operations-in-e2e",
    "local/require-e2e-fixture-import",
    "local/require-e2e-page-fixture",
  ]);
});

// The frontend foundation places feature-specific UI and state under
// src/features. A directory alone does not hold that: without the boundaries
// policy, feature code could sit in src/app or reach into a sibling feature and
// nothing would say so. These lint real files through the plugin, so the
// element patterns and the policy are both exercised as the plugin reads them.
const lintBoundaries = async (filePath, code) => {
  const [result] = await frontendEslint.lintText(code, { filePath });

  return result.messages.filter(
    ({ ruleId }) => ruleId === "boundaries/dependencies",
  );
};

test("the boundaries policy is enforced for feature, app, and shared code", async () => {
  for (const filePath of [
    "src/features/postal-generator/views/GeneratorForm.tsx",
    "src/app/views/GeneratorView.tsx",
    "src/api/api-client.ts",
  ]) {
    await assertRuleEnabled(
      frontendEslint,
      filePath,
      "boundaries/dependencies",
    );
  }
});

test("shared code may not reach into the application layer", async () => {
  const messages = await lintBoundaries(
    "src/api/api-client.ts",
    `import { RootLayout } from "../app/views/RootLayout";

export const layout = RootLayout;
`,
  );

  assert.equal(
    messages.length,
    1,
    `expected one boundaries violation, got ${JSON.stringify(messages)}`,
  );
});

test("shared code may depend on other shared code", async () => {
  // The companion to the test above: a policy that reported everything would
  // satisfy it just as well.
  const messages = await lintBoundaries(
    "src/api/api-client.ts",
    `import { cn } from "../lib/utils";

export const merge = cn;
`,
  );

  assert.deepEqual(messages, []);
});

test("nothing outside a policy may depend on anything", async () => {
  // default: "disallow" is what makes the policies exhaustive. Were it
  // "allow", an unlisted direction — app imported from a feature, say — would
  // pass silently.
  const config = await frontendEslint.calculateConfigForFile(
    "src/features/postal-generator/views/GeneratorForm.tsx",
  );
  const [, options] = config.rules["boundaries/dependencies"];

  assert.equal(options.default, "disallow");
});
