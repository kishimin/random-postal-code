import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Issue #105 acceptance test lives outside every package (ADR-0062
    // isolates acceptance/ from implementation code) and is not a Playwright
    // test, so nothing else claims it. It runs the script this package holds,
    // so this package's own Vitest run is the one that includes it.
    include: [
      "**/*.{test,spec}.ts",
      "../../../acceptance/contact-form-discord-notification.medium.test.ts",
    ],
    reporters: process.env.GITHUB_ACTIONS
      ? ["dot", "github-actions", "json"]
      : ["dot"],
    outputFile: "test-result.json",
    coverage: {
      provider: "v8",
      include: ["src/**/*.cjs"],
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      // test:coverage:pr measures only this package's own tests (`src/`).
      // The acceptance test runs the same file a second time, as a vm
      // script, and V8 merges that run's function counts into the file's
      // under the same path: onFormSubmit then reads as never called even
      // though both runs call it. The acceptance test still runs in
      // test:medium; leaving it out of the threshold only stops the merge
      // from failing a gate the package's own tests already meet.
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
