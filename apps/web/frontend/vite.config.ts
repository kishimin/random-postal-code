import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import {
  configDefaults,
  coverageConfigDefaults,
  defineConfig,
} from "vitest/config";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      "@tanstack/react-query",
      // Without pre-bundling, the router loads as its own module graph in
      // browser-mode tests and resolves a second, empty React, which surfaces
      // as "Cannot read properties of null (reading 'useContext')".
      "@tanstack/react-router",
      "aria-query",
      "lucide-react",
      "lz-string",
      "pretty-format",
    ],
  },
  test: {
    env: {
      VITE_API_BASE_URL: "http://localhost:8787",
    },
    reporters: process.env.GITHUB_ACTIONS
      ? ["dot", "github-actions", "json"]
      : ["dot"],
    outputFile: "test-result.json",
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      thresholds: process.env.COVERAGE_THRESHOLD
        ? {
            lines: Number(process.env.COVERAGE_THRESHOLD),
            statements: Number(process.env.COVERAGE_THRESHOLD),
            functions: Number(process.env.COVERAGE_THRESHOLD),
            branches: Number(process.env.COVERAGE_THRESHOLD),
          }
        : undefined,
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/components/ui/**",
        "src/main.tsx",
        "**/*.stories.{ts,tsx}",
        ".storybook/**",
        "src/tests/**",
        // Test support rather than product behavior, like src/tests above.
        "src/api/mocks/**",
        // Scaffolding with no behavior to prove. A test covering these would
        // restate the implementation — that createApp returns a Hono, that a
        // provider renders its children — and raise the number without adding
        // a reason to trust the suite. ADR-0048 asks for 80% of meaningful
        // code, so these are left out until they have some.
        //
        // Delete the matching line when the file gains behavior. Each path is
        // listed individually on purpose: a directory glob would go on hiding
        // the real code that lands next to it.
        "src/app/views/App.tsx",
        "src/app/providers/AppProviders.tsx",
        "src/lib/utils.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          globals: true,
          setupFiles: ["./src/tests/setup.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
          exclude: ["**/*.stories.{ts,tsx}"],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
    exclude: [
      ...configDefaults.exclude,
      "**/e2e/**",
      "**/acceptance/**",
      "src/**/*.spec.ts",
      "**/.storybook/**",
    ],
  },
});
