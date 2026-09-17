import { cloudflarePool } from "@cloudflare/vitest-pool-workers";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

// Tests run inside workerd rather than Node, so a behavior that depends on the
// Workers runtime — available APIs, request handling, bindings — fails here
// instead of only in production. The pool reads wrangler.jsonc so the test
// environment and the deployed Worker are configured from one file.
export default defineConfig({
  test: {
    pool: cloudflarePool({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
    reporters: process.env.GITHUB_ACTIONS
      ? ["dot", "github-actions", "json"]
      : ["dot"],
    outputFile: "test-result.json",
    coverage: {
      // istanbul rather than the v8 provider the other packages use: v8
      // coverage needs a node:inspector Session, which workerd does not
      // implement, so it reports nothing from inside the Workers runtime.
      provider: "istanbul",
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
      exclude: [...coverageConfigDefaults.exclude],
    },
  },
});
