import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import {
  configDefaults,
  coverageConfigDefaults,
  defineConfig,
} from "vitest/config";
// Extension included because this file is type checked under module: nodenext,
// where an extensionless relative specifier does not resolve.
import { createApiClient } from "./src/api/api-client.ts";
import { fillCspReportEndpoint } from "./src/app/deployment/csp-headers.ts";
import { parseAppEnv } from "./src/app/schemas/env.schema.ts";

// A production bundle served over HTTPS cannot call these, but a build aimed at
// a developer's own machine legitimately does.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/*
 * Fails the build when the environment it bakes in is not usable.
 *
 * Validating in the browser instead — which is where this check used to live —
 * means the bundle has already shipped. A build with no .env therefore
 * succeeded and produced a page that threw on load and rendered nothing:
 * silent locally, invisible in CI, where the workflow supplies the variable.
 *
 * Not restricted to `apply: "build"`. A dev server that starts without the
 * variable serves the same blank page, and the message that names the variable
 * belongs in the terminal that started it.
 */
const validateBuildEnvironment = (): Plugin => ({
  name: "zipnami:validate-build-environment",
  configResolved: ({ env, isProduction }) => {
    const { apiBaseUrl } = parseAppEnv(env);

    if (!isProduction) return;

    const { protocol, hostname } = new URL(apiBaseUrl);

    // Pages serves over HTTPS, so a plain-http API is not merely insecure: the
    // browser blocks every call as mixed content, after the deploy, with
    // nothing in the build to point at.
    if (protocol !== "https:" && !LOCAL_HOSTNAMES.has(hostname)) {
      throw new Error(
        `VITE_API_BASE_URL must use https in a production build; got ${apiBaseUrl}.`,
      );
    }
  },
});

/*
 * Writes the Worker's CSP report endpoint into the built _headers (Issue
 * #72). public/_headers carries a placeholder because the Worker's URL is
 * only known per build. Vite copies public/ into the output first, and
 * this rewrites that copy once the bundle is closed. The build fails if the
 * placeholder is missing or the URL cannot be written safely, so a deploy
 * never serves a policy with a broken endpoint.
 */
const writeCspReportEndpoint = (): Plugin => {
  const target = { headersFile: "", endpoint: "" };

  return {
    name: "zipnami:csp-report-endpoint",
    apply: "build",
    configResolved: (config) => {
      target.headersFile = path.resolve(
        config.root,
        config.build.outDir,
        "_headers",
      );
      target.endpoint = createApiClient(
        parseAppEnv(config.env).apiBaseUrl,
      ).resolveUrl("api/csp-report");
    },
    closeBundle: () => {
      writeFileSync(
        target.headersFile,
        fillCspReportEndpoint(
          readFileSync(target.headersFile, "utf8"),
          target.endpoint,
        ),
      );
    },
  };
};

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

/*
 * The browser that runs unit tests and stories cannot resolve the AdSense
 * host (Issue #61). MSW's stand-in loader (src/api/mocks/handlers.ts)
 * answers every AdSense request it sees, because the Service Worker
 * intercepts before the network. In CI, though, a request sometimes got
 * past it, and Google's real adsbygoogle.js then ran against the test DOM
 * and threw TagError. With the host unresolvable, such a request fails like
 * an ad blocker would, which the loader already handles, instead of
 * loading third-party code into a test.
 */
const testBrowser = playwright({
  launchOptions: {
    args: ["--host-resolver-rules=MAP pagead2.googlesyndication.com ~NOTFOUND"],
  },
});

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    validateBuildEnvironment(),
    writeCspReportEndpoint(),
  ],
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
        // Scaffolding with no behavior to prove. A test covering this would
        // restate the implementation — that cn() calls twMerge — and raise the
        // number without adding a reason to trust the suite. ADR-0048 asks for
        // 80% of meaningful code, so it is left out until it has some.
        //
        // Delete the matching line when the file gains behavior. Each path is
        // listed individually on purpose: a directory glob would go on hiding
        // the real code that lands next to it.
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
            provider: testBrowser,
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
            provider: testBrowser,
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
