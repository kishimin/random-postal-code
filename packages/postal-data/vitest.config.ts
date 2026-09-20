import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The acceptance test for Issue #3 lives outside every package (ADR-0062
    // isolates acceptance/ from implementation code) and is not a Playwright
    // test, so nothing else in the workspace claims it. This package is the
    // one the test exercises, so its own Vitest run is the one that includes
    // it, alongside the package's own small/medium/large test files.
    include: [
      "**/*.{test,spec}.ts",
      "../../acceptance/postal-data-normalization.medium.test.ts",
    ],
    reporters: process.env.GITHUB_ACTIONS
      ? ["dot", "github-actions", "json"]
      : ["dot"],
    outputFile: "test-result.json",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
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
    },
  },
});
