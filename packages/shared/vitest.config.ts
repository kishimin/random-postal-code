import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
      exclude: [
        ...coverageConfigDefaults.exclude,
        // Currently `export {}` — a placeholder with nothing to cover. The
        // Address, PostalCode, and error-envelope schemas arrive with Issue #2;
        // delete this line then, so the schemas are measured like any other
        // code. Listed as a single path rather than a glob, so a new file in
        // src/ is measured by default.
        "src/index.ts",
      ],
    },
  },
});
