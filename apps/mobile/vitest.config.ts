import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Issue #12 acceptance test lives outside every package (ADR-0062
    // isolates acceptance/ from implementation code) and is not a Playwright
    // test. It builds this package with `expo export`, so this package's own
    // Vitest run is the one that includes it.
    include: [
      "src/**/*.test.ts",
      "../../acceptance/mobile-expo-foundation.medium.test.ts",
    ],
    // Two `expo export` runs take minutes on a CI runner.
    testTimeout: 1_200_000,
    hookTimeout: 1_200_000,
    reporters: process.env.GITHUB_ACTIONS
      ? ["dot", "github-actions", "json"]
      : ["dot"],
    outputFile: "test-result.json",
    coverage: {
      provider: "v8",
      // Logic that runs without React Native. The screens are measured by
      // the acceptance test's export, not by line coverage.
      include: ["src/config/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
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
