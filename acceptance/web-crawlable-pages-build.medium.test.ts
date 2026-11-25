import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { adSenseLoaderReference } from "./selectors/crawlable-page-selectors.ts";

/*
 * Acceptance test for Issue #169: Serve each content page as its own
 * crawlable HTML, with robots.txt, a sitemap and real 404s (build half).
 *
 * Each test name starts with the acceptance criteria it holds, numbered in
 * the Issue's order:
 *
 *   AC-6  An unknown path answers HTTP 404: the build Pages deploys carries a
 *         top-level 404.html and no catch-all rewrite to index.html, which is
 *         what makes Cloudflare Pages answer an unmatched path with 404.html
 *         and status 404 instead of the generator's 200 (Cloudflare Pages,
 *         "Serving Pages": without a top-level 404.html, Pages assumes a
 *         single-page application).
 *   AC-7  Every page's <head> carries <meta name="google-adsense-account">
 *         with the publisher ID the build was given, and a development build
 *         without a real ID emits no such tag.
 *   AC-8  No page of either build loads the AdSense loader from its HTML, so
 *         #120's rule that only the result screen requests ads still holds.
 *
 * The browser half (the content, robots.txt, the sitemap, the 404 status
 * under vite preview, and the client after load) is
 * web-crawlable-pages.medium.test.ts.
 *
 * How it is observed
 * ------------------
 * The production build is made the way Issue #92's test makes it: `vite
 * build` into a temporary directory, with every VITE_, ZIPNAMI_ and
 * CLOUDFLARE_ variable removed from the environment and only the ones under
 * test set. So prerendering has to happen inside `vite build` itself, not in
 * a step only `bun run build` runs. Every .html file the build emits is a
 * page Pages serves; the seven content routes and the not-found page make at
 * least eight of them.
 *
 * The publisher ID is a well-formed, made-up ca-pub- ID. A build with no
 * VITE_GOOGLE_ADSENSE_CLIENT_ID set is the development build: it requests ads
 * under the placeholder apps/web/frontend/src/app/schemas/env.schema.ts
 * defines, which names no publisher.
 *
 * Why Medium: it reads the file system and spawns local builds. No network.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontend = path.join(repositoryRoot, "apps", "web", "frontend");

const BUILD_TIMEOUT_MS = 300_000;

const publisherId = "ca-pub-1234567890123456";

// The seven content routes of ui-design.md section 3.1 and the not-found page.
const minimumPageCount = 8;

type Build = { outDir: string; error: string };

/**
 * Builds the frontend for production into a new temporary directory.
 * @param prefix - The temporary directory's name prefix.
 * @param env - The only build variables set, beyond the clean environment.
 */
const buildFrontend = (prefix: string, env: Record<string, string>): Build => {
  const outDir = mkdtempSync(path.join(tmpdir(), prefix));
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(VITE_|ZIPNAMI_|ALLOWED_ORIGINS$|CLOUDFLARE_)/.test(key),
    ),
  );
  const result = spawnSync(
    "bun",
    ["x", "vite", "build", "--outDir", outDir, "--emptyOutDir"],
    {
      cwd: frontend,
      encoding: "utf8",
      env: {
        ...cleanEnv,
        VITE_API_BASE_URL: "http://127.0.0.1:8787",
        ...env,
      },
      timeout: BUILD_TIMEOUT_MS,
    },
  );

  if (result.status !== 0) {
    return {
      outDir,
      error: `vite build failed (${String(result.status ?? result.error)}):\n${result.stdout}\n${result.stderr}`,
    };
  }

  return { outDir, error: "" };
};

const builds: { withPublisher?: Build; withoutPublisher?: Build } = {};

beforeAll(() => {
  builds.withPublisher = buildFrontend("zipnami-crawlable-publisher-", {
    VITE_GOOGLE_ADSENSE_CLIENT_ID: publisherId,
  });
  builds.withoutPublisher = buildFrontend("zipnami-crawlable-dev-", {});
}, 2 * BUILD_TIMEOUT_MS);

afterAll(() => {
  for (const build of [builds.withPublisher, builds.withoutPublisher]) {
    if (build) rmSync(build.outDir, { recursive: true, force: true });
  }
});

/**
 * The build's output directory, once the build is known to have succeeded.
 * @param build - The build to read.
 */
const outputOf = (build: Build | undefined) => {
  expect(build?.error).toBe("");
  return build?.outDir ?? "";
};

/**
 * Every HTML file of a build, by its path relative to the output directory.
 * @param outDir - The build's output directory.
 */
const htmlFilesOf = (outDir: string): Record<string, string> =>
  Object.fromEntries(
    readdirSync(outDir, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".html"))
      .map((name) => [
        name.split(path.sep).join("/"),
        readFileSync(path.join(outDir, name), "utf8"),
      ]),
  );

/**
 * The value of one attribute of an HTML tag, whichever quotes it uses.
 * @param tag - The whole start tag.
 * @param name - The attribute's name.
 */
const attributeOf = (tag: string, name: string) =>
  new RegExp(String.raw`\s${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`, "i")
    .exec(tag)
    ?.slice(1)
    .find((value) => value !== undefined);

/**
 * The content of every google-adsense-account meta tag in a piece of HTML.
 * @param html - The HTML to search.
 */
const adSenseAccountTagsIn = (html: string) =>
  [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => attributeOf(tag, "name") === "google-adsense-account")
    .map((tag) => attributeOf(tag, "content") ?? "");

/**
 * The document head of an HTML file, or "" when it has none.
 * @param html - The whole file.
 */
const headOf = (html: string) =>
  /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? "";

describe("Issue #169: the production build names the AdSense publisher on every page and tells Pages about unknown paths", () => {
  test("AC-7 a build with the publisher ID names it once, in the <head> of every page", () => {
    const pages = htmlFilesOf(outputOf(builds.withPublisher));

    expect(Object.keys(pages).length).toBeGreaterThanOrEqual(minimumPageCount);

    const tags = Object.fromEntries(
      Object.entries(pages).map(([name, html]) => [
        name,
        {
          inHead: adSenseAccountTagsIn(headOf(html)),
          inFile: adSenseAccountTagsIn(html).length,
        },
      ]),
    );
    expect(tags).toEqual(
      Object.fromEntries(
        Object.keys(pages).map((name) => [
          name,
          { inHead: [publisherId], inFile: 1 },
        ]),
      ),
    );
  });

  test("AC-7 a development build without a real publisher ID emits no google-adsense-account tag", () => {
    const pages = htmlFilesOf(outputOf(builds.withoutPublisher));

    // Prerendered as well, so "no tag" is about pages that exist.
    expect(Object.keys(pages).length).toBeGreaterThanOrEqual(minimumPageCount);

    const tagged = Object.entries(pages)
      .filter(([, html]) => adSenseAccountTagsIn(html).length > 0)
      .map(([name]) => name);
    expect(tagged).toEqual([]);
  });

  test("AC-8 no page of either build loads the AdSense loader from its HTML", () => {
    const loading = [
      ...Object.entries(htmlFilesOf(outputOf(builds.withPublisher))),
      ...Object.entries(htmlFilesOf(outputOf(builds.withoutPublisher))),
    ]
      .filter(([, html]) => adSenseLoaderReference.test(html))
      .map(([name]) => name);

    expect(loading).toEqual([]);
  });

  test("AC-6 the build carries a top-level 404.html and no catch-all rewrite, so Pages answers an unknown path with 404", () => {
    const outDir = outputOf(builds.withPublisher);

    expect(existsSync(path.join(outDir, "404.html"))).toBe(true);

    // A _redirects rule from a splat to a page with status 200 is the SPA
    // fallback that answered every unknown path with the generator.
    const redirectsFile = path.join(outDir, "_redirects");
    const catchAllRewrites = existsSync(redirectsFile)
      ? readFileSync(redirectsFile, "utf8")
          .split(/\r?\n/)
          .map((line) => line.replace(/#.*$/, "").trim())
          .map((line) => line.split(/\s+/))
          .filter(
            ([source, , status]) =>
              source !== undefined && source.includes("*") && status === "200",
          )
          .map((fields) => fields.join(" "))
      : [];
    expect(catchAllRewrites).toEqual([]);
  });
});
