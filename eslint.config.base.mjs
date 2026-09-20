import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsdocPlugin from "eslint-plugin-jsdoc";
import oxlint from "eslint-plugin-oxlint";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Shared ESLint configuration for the non-React TypeScript packages.
 *
 * The frontend keeps its own configuration because its rules are about React,
 * browser behavior, and Page Objects. Everything below is what those packages
 * have in common, kept in one place so they cannot drift into disagreeing about
 * the same rule.
 * @param root0 - Configuration for the consuming package.
 * @param root0.tsconfigRootDir - Directory the type-aware rules resolve tsconfig from.
 * @param root0.oxlintConfigPath - Absolute path to the package's .oxlintrc.json.
 */
export const createBaseConfig = ({ tsconfigRootDir, oxlintConfigPath }) =>
  defineConfig([
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

    {
      files: ["**/*.ts"],
      extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        tseslint.configs.recommendedTypeChecked,
        importPlugin.flatConfigs.recommended,
        importPlugin.flatConfigs.typescript,
      ],
      settings: {
        "import/resolver": {
          typescript: true,
          node: true,
        },
      },
      languageOptions: {
        ecmaVersion: 2023,
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        "max-params": ["error", 5],
        "no-console": "warn",
        "no-restricted-syntax": [
          "error",
          {
            // Class methods are excluded: a method's value is a
            // FunctionExpression in the AST, but an arrow has no equivalent
            // that keeps prototype semantics.
            selector:
              "FunctionDeclaration, FunctionExpression:not(MethodDefinition > FunctionExpression)",
            message: "Use an arrow function instead.",
          },
          {
            selector: "VariableDeclaration[kind='let']",
            message: "Use const instead of let.",
          },
        ],
        camelcase: ["warn", { properties: "never" }],
        "@typescript-eslint/switch-exhaustiveness-check": "warn",
        "@typescript-eslint/no-explicit-any": "error",
        // Promise-returning operations must be observed so request handling and
        // asynchronous side effects cannot fail silently.
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": "error",
        "import/order": [
          "error",
          {
            alphabetize: { order: "asc", caseInsensitive: true },
            "newlines-between": "never",
          },
        ],
      },
    },

    {
      files: [
        "**/*.{small,medium,large}.test.ts",
        "**/*.test.ts",
        "**/tests/**/*.ts",
      ],
      plugins: { vitest },
      rules: {
        ...vitest.configs.recommended.rules,
        "vitest/max-nested-describe": ["error", { max: 3 }],
        "vitest/consistent-test-it": [
          "error",
          { fn: "test", withinDescribe: "test" },
        ],
        "vitest/no-focused-tests": "error",
        "vitest/no-disabled-tests": "warn",
        "vitest/require-mock-type-parameters": "error",
      },
      settings: { vitest: { typecheck: true } },
      languageOptions: { globals: { ...vitest.environments.env.globals } },
    },

    jsdocPlugin.configs["flat/recommended"],
    {
      rules: {
        "jsdoc/require-param": "off",
        "jsdoc/require-returns": "off",
        "jsdoc/require-description": "off",
        "jsdoc/check-values": ["error", { allowedLicenses: ["MIT", "ISC"] }],
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
    },

    {
      files: ["*.config.{js,mjs,ts,mts}"],
      extends: [tseslint.configs.disableTypeChecked],
      languageOptions: { globals: globals.node },
    },

    // Prettier must be last, before oxlint takes over disabling its own rules.
    prettier,

    // Turn off every rule oxlint already covers so the same violation is not
    // reported twice; run `oxlint` before `eslint`.
    ...oxlint.buildFromOxlintConfigFile(oxlintConfigPath),
  ]);
