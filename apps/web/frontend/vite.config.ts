import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { build, type Plugin, type ResolvedConfig } from "vite";
import {
  configDefaults,
  coverageConfigDefaults,
  defineConfig,
} from "vitest/config";
import { z } from "zod";
// Extension included because this file is type checked under module: nodenext,
// where an extensionless relative specifier does not resolve.
import { createApiClient } from "./src/api/api-client.ts";
import { adsTxtFor } from "./src/app/deployment/ads-txt.ts";
import { adSenseAccountFor } from "./src/app/deployment/adsense-account.ts";
import { fillCspReportEndpoint } from "./src/app/deployment/csp-headers.ts";
import {
  decodePagesPathname,
  pagesFileFor,
} from "./src/app/deployment/pages-routing.ts";
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
 * Whether this build is the application's own: the one that bundles index.html
 * for the browser and whose output is deployed.
 *
 * Storybook loads this file's plugins into its own `vite build`, with its own
 * input (iframe.html) and output directory. The plugins below write deployment
 * files into the output, so left running there they put robots.txt, sitemap.xml,
 * ads.txt and a page per route into storybook-static, or fail on an index.html
 * that Storybook has not written yet.
 */
const isAppClientBuild = ({ build: { rollupOptions, ssr } }: ResolvedConfig) =>
  rollupOptions.input === undefined && !ssr;

/*
 * Writes the Worker's CSP report endpoint into the built _headers (Issue
 * #72). public/_headers carries a placeholder because the Worker's URL is
 * only known per build. Vite copies public/ into the output first, and
 * this rewrites that copy once the bundle is closed. The build fails if the
 * placeholder is missing or the URL cannot be written safely, so a deploy
 * never serves a policy with a broken endpoint.
 */
const writeCspReportEndpoint = (): Plugin => {
  const target = { enabled: false, headersFile: "", endpoint: "" };

  return {
    name: "zipnami:csp-report-endpoint",
    apply: "build",
    configResolved: (config) => {
      target.enabled = isAppClientBuild(config);
      if (!target.enabled) return;

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
      if (!target.enabled) return;

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

/*
 * Writes ads.txt from the AdSense client ID the bundle is built with. Not a
 * static file in public/: the publisher is known only per build, and a build
 * without a real one (the development placeholder) publishes none. Without
 * the file, Pages answers /ads.txt with its 404 page, which AdSense reports
 * as a missing ads.txt.
 */
const writeAdsTxt = (): Plugin => {
  const target = { file: "", contents: null as string | null };

  return {
    name: "zipnami:ads-txt",
    apply: "build",
    configResolved: (config) => {
      if (!isAppClientBuild(config)) return;

      target.file = path.resolve(config.root, config.build.outDir, "ads.txt");
      target.contents = adsTxtFor(
        parseAppEnv(config.env).googleAdsenseClientId,
      );
    },
    closeBundle: () => {
      if (target.contents !== null) writeFileSync(target.file, target.contents);
    },
  };
};

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const sourceAlias = { "@": path.resolve(dirname, "./src") };

const PRERENDER_ENTRY = "src/app/prerender/prerender-site.ts";
const PRERENDER_MODULE = "prerender-site.mjs";

const siteFilesSchema = z.array(
  z.object({ file: z.string(), contents: z.string() }),
);

/*
 * Runs the module the server-side build wrote and returns the files it
 * produced. Checked at run time rather than cast: the module is built output
 * this file only knows by name, and a wrong shape should fail the build with
 * a message instead of writing nothing.
 */
const renderSiteFiles = async (
  builtModule: string,
  template: string,
  adSenseAccount: string | null,
) => {
  const entry: unknown = await import(pathToFileURL(builtModule).href);

  if (
    typeof entry !== "object" ||
    entry === null ||
    !("buildSiteFiles" in entry) ||
    typeof entry.buildSiteFiles !== "function"
  ) {
    throw new Error(`${builtModule} does not export buildSiteFiles.`);
  }

  return siteFilesSchema.parse(
    await entry.buildSiteFiles(template, adSenseAccount),
  );
};

/*
 * Writes each content route, and the not-found screen, to the HTML file Pages
 * serves for it, plus robots.txt and sitemap.xml (Issue #169). A crawler that
 * runs no JavaScript then reads each page's own content instead of the empty
 * root of one shared index.html.
 *
 * Inside `vite build` itself rather than a step `bun run build` adds, because
 * the build is also run directly (the acceptance tests and the Large config
 * do), and a deployment made that way must not serve the empty shell.
 *
 * The pages are rendered by a second, server-side build of the application
 * that this one starts once its own bundle is written. It is a build of its
 * own, with none of this file's plugins, so it neither recurses nor writes
 * into the output a second time, and its asset URLs are the ones the client
 * bundle uses (content-hashed). Rendering needs a Node module, and the
 * application is TSX, which Node cannot import as it is.
 *
 * The built index.html is the template, so every page carries the bundle's
 * script and style tags without this file knowing their names. The client
 * still mounts with createRoot and replaces the markup, so no hydration
 * mismatch is possible.
 */
const prerenderContentRoutes = (): Plugin => {
  const target = {
    enabled: false,
    root: "",
    outDir: "",
    mode: "",
    adSenseAccount: null as string | null,
  };

  return {
    name: "zipnami:prerender-content-routes",
    apply: "build",
    configResolved: (config) => {
      target.enabled = isAppClientBuild(config);
      if (!target.enabled) return;

      target.root = config.root;
      target.outDir = path.resolve(config.root, config.build.outDir);
      target.mode = config.mode;
      target.adSenseAccount = adSenseAccountFor(
        parseAppEnv(config.env).googleAdsenseClientId,
      );
    },
    // writeBundle rather than closeBundle: it runs only when the bundle was
    // written, so a failed build reports its own error and not a missing
    // index.html.
    writeBundle: async () => {
      if (!target.enabled) return;

      // Under node_modules so the externalized dependencies (react, the
      // router) resolve from where the application's own are installed. Unique
      // to this build: two builds running at once (the acceptance tests start
      // one each) would otherwise empty and delete each other's output.
      const modulesDir = path.join(target.root, "node_modules");
      mkdirSync(modulesDir, { recursive: true });
      const renderDir = mkdtempSync(
        path.join(modulesDir, ".zipnami-prerender-"),
      );

      try {
        await build({
          configFile: false,
          root: target.root,
          mode: target.mode,
          logLevel: "warn",
          plugins: [react()],
          resolve: { alias: sourceAlias },
          build: {
            ssr: PRERENDER_ENTRY,
            outDir: renderDir,
            emptyOutDir: true,
            rollupOptions: { output: { entryFileNames: PRERENDER_MODULE } },
          },
        });

        // Read before anything is written: the root's page replaces index.html.
        const template = readFileSync(
          path.join(target.outDir, "index.html"),
          "utf8",
        );
        const files = await renderSiteFiles(
          path.join(renderDir, PRERENDER_MODULE),
          template,
          target.adSenseAccount,
        );

        for (const { file, contents } of files) {
          const destination = path.join(target.outDir, file);
          mkdirSync(path.dirname(destination), { recursive: true });
          writeFileSync(destination, contents);
        }
      } finally {
        rmSync(renderDir, { recursive: true, force: true });
      }
    },
  };
};

/*
 * Makes `vite preview` answer a request the way Cloudflare Pages answers it
 * for the same build (Issue #169): a route from its own .html file, and a path
 * no file matches with 404.html and status 404. Without it the preview serves
 * index.html for every unmatched path, as it does for a single-page
 * application, and the tests that run against the preview would describe a
 * deployment that no longer exists.
 *
 * Registered ahead of the preview's own file server, which would otherwise
 * answer first.
 */
const answerLikePages = (): Plugin => ({
  name: "zipnami:answer-like-pages",
  configurePreviewServer: ({ config, middlewares }) => {
    const outDir = path.resolve(config.root, config.build.outDir);
    const notFoundFile = path.join(outDir, "404.html");
    const isFile = (file: string) => {
      const resolved = path.join(outDir, file);
      // Whatever the path spelled, never answer with a file outside the build.
      if (!resolved.startsWith(`${outDir}${path.sep}`)) return false;

      try {
        return statSync(resolved).isFile();
      } catch {
        return false;
      }
    };

    middlewares.use((request, response, next) => {
      if (request.method !== "GET" && request.method !== "HEAD") return next();

      const { pathname, search } = new URL(
        request.url ?? "/",
        "http://preview",
      );
      const decoded = decodePagesPathname(pathname);
      if (decoded === null) {
        response.statusCode = 400;
        response.end();
        return;
      }

      const file = pagesFileFor(decoded, isFile);
      if (file !== null) {
        request.url = `${file}${search}`;
        return next();
      }
      if (!existsSync(notFoundFile)) return next();

      response.statusCode = 404;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(
        request.method === "HEAD" ? undefined : readFileSync(notFoundFile),
      );
    });
  },
});

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
    writeAdsTxt(),
    prerenderContentRoutes(),
    answerLikePages(),
  ],
  resolve: {
    alias: sourceAlias,
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
      // Only the prerender test renders to a string. Found late, it makes Vite
      // re-optimize and reload mid-run, which leaves two copies of React in
      // the page ("Cannot read properties of null (reading 'useState')").
      "react-dom/server",
    ],
  },
  test: {
    env: {
      VITE_API_BASE_URL: "http://localhost:8787",
      // Pinned empty rather than inherited: the PR workflow exports a
      // placeholder key to every job for the production build, and a unit
      // suite that picked it up would mount an iframe pointed at Google
      // instead of the fallback its tests are written against. A suite that
      // needs the keyed path passes a key to the component directly.
      VITE_GOOGLE_MAPS_API_KEY: "",
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
