import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import { defineConfig, globalIgnores } from "eslint/config";
import boundaries from "eslint-plugin-boundaries";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsdocPlugin from "eslint-plugin-jsdoc";
import oxlint from "eslint-plugin-oxlint";
import react from "eslint-plugin-react";
import storybook from "eslint-plugin-storybook";
import testingLibrary from "eslint-plugin-testing-library";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";
import preferObjectDerivedUnion from "./eslint-rules/prefer-object-derived-union.mjs";
import preferNamedExportsInUtils from "./eslint-rules/prefer-named-exports-in-utils.mjs";
import limitPropsKeys from "./eslint-rules/limit-props-keys.mjs";
import requireE2eTestDirectory from "./eslint-rules/require-e2e-test-directory.mjs";
import requireE2eFixtureImport from "./eslint-rules/require-e2e-fixture-import.mjs";
import noRawPageOperationsInE2e from "./eslint-rules/no-raw-page-operations-in-e2e.mjs";
import requireE2ePageFixture from "./eslint-rules/require-e2e-page-fixture.mjs";
import requireE2eLocatorFunctions from "./eslint-rules/require-e2e-locator-functions.mjs";
import requireE2ePageObjectMethodReferences from "./eslint-rules/require-e2e-page-object-method-references.mjs";

export default defineConfig([
  // Global ignores
  globalIgnores([
    "dist",
    "coverage/**",
    "storybook-static/**",
    "public/mockServiceWorker.js",
    "src/components/ui/*.tsx",
    "!src/components/ui/*.stories.tsx",
    ".stryker-tmp/**",
    "reports/**",
  ]),

  // Unused imports (applies broadly)
  {
    plugins: {
      "unused-imports": unusedImports,
      "@eslint-community/eslint-comments": eslintComments,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "@eslint-community/eslint-comments/require-description": "error",
    },
  },

  // TypeScript + React files
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      react.configs.flat.recommended,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        typescript: true,
        node: true,
      },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "local/prefer-object-derived-union": "error",
      "local/prefer-named-exports-in-utils": "error",
      "local/limit-props-keys": "error",
      "max-params": ["error", 5],
      "no-console": "warn",
      "no-restricted-syntax": [
        "error",
        {
          selector: "FunctionDeclaration, FunctionExpression",
          message: "Use an arrow function instead.",
        },
        {
          selector: "MemberExpression[object.name='React']",
          message:
            "Import React APIs directly instead of using the React namespace.",
        },
        {
          selector: "JSXAttribute[value.type='Literal']",
          message: "Wrap JSX string attributes in braces.",
        },
        {
          selector: "JSXText[value=/\\S/]",
          message: "Wrap JSX text in braces.",
        },
        {
          selector: "VariableDeclaration[kind='let']",
          message: "Use const instead of let.",
        },
      ],
      camelcase: ["warn", { properties: "never" }],
      "@typescript-eslint/switch-exhaustiveness-check": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      // Promise-returning operations must be observed so user actions and
      // asynchronous side effects cannot fail silently.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "import/order": [
        "error",
        {
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          "newlines-between": "never",
        },
      ],
      "react/jsx-key": ["error", { checkFragmentShorthand: true }],
      "react/react-in-jsx-scope": 0,
      "react/jsx-uses-react": 0,
    },
    plugins: {
      local: {
        rules: {
          "prefer-object-derived-union": preferObjectDerivedUnion,
          "prefer-named-exports-in-utils": preferNamedExportsInUtils,
          "limit-props-keys": limitPropsKeys,
          "require-e2e-test-directory": requireE2eTestDirectory,
          "require-e2e-fixture-import": requireE2eFixtureImport,
          "no-raw-page-operations-in-e2e": noRawPageOperationsInE2e,
          "require-e2e-page-fixture": requireE2ePageFixture,
          "require-e2e-locator-functions": requireE2eLocatorFunctions,
          "require-e2e-page-object-method-references":
            requireE2ePageObjectMethodReferences,
        },
      },
    },
  },

  // Pure utility functions stay small; React components and test bodies are
  // intentionally outside this rule's scope.
  {
    files: ["src/**/utils/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "max-lines-per-function": [
        "error",
        { max: 30, skipBlankLines: true, skipComments: true },
      ],
    },
  },

  // Feature UI components consume UI-owned types; API domain models stay at the
  // feature boundary where request and response mapping is performed.
  {
    files: ["src/features/*/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/models/*"],
              message:
                "UI components must use UI-owned types instead of API domain models.",
            },
          ],
        },
      ],
    },
  },

  // bulletproof-react style architectural boundaries: shared/ never depends on
  // features/ or app/, features/<feature> never imports another feature, and
  // nothing depends on app/. models/ and external packages are left
  // unclassified on purpose, so they stay unrestricted.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        {
          type: "feature",
          pattern: "src/features/(*)/**",
          capture: ["featureName"],
        },
        {
          type: "shared",
          pattern:
            "src/{api,components,hooks,images,lib,models,providers,schemas,theme,types,utils,tests}/**",
        },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "shared" } },
              allow: { to: { element: { type: "shared" } } },
              message:
                "shared/ code must not depend on features/ or app/ (unidirectional architecture).",
            },
            {
              from: { element: { type: "feature" } },
              allow: {
                to: {
                  element: [
                    { type: "shared" },
                    {
                      type: "feature",
                      captured: { featureName: "{{from.featureName}}" },
                    },
                  ],
                },
              },
              message:
                "features/<feature> must not import from another feature; only from shared/ or the same feature.",
            },
            {
              from: { element: { type: "app" } },
              allow: {
                to: { element: { types: { anyOf: ["shared", "feature"] } } },
              },
              message:
                "app/ may import shared/ and features/, but nothing may import app/.",
            },
          ],
        },
      ],
    },
  },

  // Test files: Testing Library + Vitest
  {
    files: [
      "src/**/*.{small,medium,large}.test.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
      "src/**/tests/**/**/*.{ts,tsx}",
    ],
    ...testingLibrary.configs["flat/react"],
    plugins: {
      ...testingLibrary.configs["flat/react"].plugins,
      vitest,
    },
    rules: {
      ...testingLibrary.configs["flat/react"].rules,
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "vitest/max-nested-describe": ["error", { max: 3 }],
      "vitest/consistent-test-it": [
        "error",
        { fn: "test", withinDescribe: "test" },
      ],
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/require-mock-type-parameters": "error",
    },
    settings: {
      vitest: { typecheck: true },
    },
    languageOptions: { globals: { ...vitest.environments.env.globals } },
  },

  // Playwright tests use the project fixture entry point and Page Objects.
  {
    files: ["e2e/**/*.{ts,tsx}"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      "local/require-e2e-test-directory": "error",
      "local/require-e2e-fixture-import": "error",
      "local/no-raw-page-operations-in-e2e": "error",
      "local/require-e2e-page-fixture": "error",
      // Keep E2E imports aligned with the TypeScript files they load. This
      // prevents runtime-only .js specifiers and ambiguous extensionless paths.
      "import/extensions": [
        "error",
        "always",
        {
          js: "never",
          jsx: "never",
          ts: "always",
          tsx: "always",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^getBy(Role|LabelText|Text|Placeholder)$/] ObjectExpression > Property[key.name='name'][value.type='Literal'][value.regex=null]",
          message:
            "Use a regular expression for accessible locator names in E2E tests.",
        },
      ],
    },
  },

  {
    files: ["e2e/pages/**/*.{ts,tsx}"],
    rules: {
      "local/require-e2e-locator-functions": "error",
      "local/require-e2e-page-object-method-references": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^getBy(Role|LabelText|Text|Placeholder)$/] ObjectExpression > Property[key.name='name'][value.regex]",
          message:
            "Define E2E locator names in the page selector module instead of inline.",
        },
        {
          selector: "VariableDeclarator[id.name='goto']",
          message: "Use navigate for Page Object navigation functions.",
        },
        {
          selector: "Property[key.name='open']",
          message: "Use navigate for Page Object navigation functions.",
        },
        {
          selector:
            "VariableDeclarator[id.name=/Page$/] > ArrowFunctionExpression > ObjectExpression",
          message:
            "Return Page Object operations explicitly from a block body.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(fill|selectOption|type)$/] > Literal:first-child",
          message: "Pass scenario input values into Page Object functions.",
        },
      ],
    },
  },

  // Storybook story files
  ...storybook.configs["flat/recommended"],

  // JSDoc rules
  jsdocPlugin.configs["flat/recommended"],
  {
    rules: {
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-description": "off",
      "jsdoc/check-values": [
        "error",
        {
          allowedLicenses: ["MIT", "ISC"],
        },
      ],
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
        },
      ],
    },
    settings: {
      structuredTags: {
        see: {
          name: "namepath-referencing",
          required: ["name"],
        },
      },
    },
  },

  // Disable type-checked rules for config/tooling files
  {
    files: [
      "*.config.{js,mjs,ts,mts}",
      ".storybook/main.ts",
      "eslint-rules/*.mjs",
    ],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "testing-library/prefer-screen-queries": "off",
    },
  },

  // Prettier must be last, before oxlint takes over disabling its own rules
  prettier,

  // Turn off every rule oxlint already covers (see .oxlintrc.json) so the
  // same violation isn't reported twice; run `oxlint` before `eslint`.
  // Resolved from this file rather than the working directory, so the config
  // behaves the same when ESLint is invoked from the repository root.
  ...oxlint.buildFromOxlintConfigFile(
    fileURLToPath(new URL("./.oxlintrc.json", import.meta.url)),
  ),
]);
