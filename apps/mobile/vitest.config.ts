import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The export-based acceptance tests live outside every package (ADR-0062
    // isolates acceptance/ from implementation code) and are not Playwright
    // tests. They build this package with `expo export`, so this package's
    // own Vitest run is the one that includes them. The screen tests render
    // React Native and run under Jest instead (jest.config.js).
    include: [
      "src/**/*.test.ts",
      "../../acceptance/mobile-expo-foundation.medium.test.ts",
      "../../acceptance/mobile-app-identifier.medium.test.ts",
      "../../acceptance/mobile-random-postal-code-bundle.medium.test.ts",
    ],
    // Two `expo export` runs take about a minute locally. The bound stays
    // well inside the CI Medium job's 20 minutes, so a stuck export fails
    // this test rather than cancelling the whole job.
    testTimeout: 600_000,
    hookTimeout: 600_000,
    reporters: process.env.GITHUB_ACTIONS
      ? ["dot", "github-actions", "json"]
      : ["dot"],
    outputFile: "test-result.json",
    coverage: {
      provider: "v8",
      // Logic that runs without React Native. The screens are measured by
      // the Jest screen tests, not by this line coverage.
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
