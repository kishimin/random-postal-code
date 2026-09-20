import { cloudflarePool } from "@cloudflare/vitest-pool-workers";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

// Tests run inside workerd rather than Node, so a behavior that depends on the
// Workers runtime — available APIs, request handling, bindings — fails here
// instead of only in production. The pool reads wrangler.jsonc so the test
// environment and the deployed Worker are configured from one file.
//
// The pool applies to every test in this package, which reads wrangler.jsonc
// from disk and runs the Worker in a second process. Both put any test here
// past what a small test may use, so this package has no .small.test.ts and
// should not gain one: the size filter reads the name, not the runtime, and a
// mis-named file would run on push where ADR-0043 puts medium tests later.
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
      exclude: [
        ...coverageConfigDefaults.exclude,
        // Scaffolding with no behavior to prove. createApp returns a bare Hono
        // and index.ts only wires it to the fetch handler, so a test over them
        // would restate the implementation and raise the number without adding
        // a reason to trust the suite. ADR-0048 asks for 80% of meaningful
        // code, so these are left out until they have some.
        //
        // Delete the matching line when the file gains behavior: routes and the
        // error envelope arrive with Issues #4 and #11. Each path is listed
        // individually on purpose, so a later src/ file is measured by default.
        "src/app.ts",
        // The Worker entry point, excluded for the same reason the frontend
        // excludes src/main.tsx: it composes, it does not decide. Excluded from
        // behavior coverage, not from testing — worker.medium.test.ts runs it
        // to show the runtime starts, which is a different claim.
        "src/index.ts",
      ],
    },
  },
});
