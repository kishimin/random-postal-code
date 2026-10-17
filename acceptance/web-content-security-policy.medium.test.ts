import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #38: Add a Content-Security-Policy restricting
 * script sources.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What is served, and how this test sees it
 * -----------------------------------------
 * The decision recorded on Issue #38 (2026-10-17, option C) is to serve the
 * policy first as Content-Security-Policy-Report-Only and enforce it later.
 * The frontend is deployed statically to Cloudflare Pages (design.md section
 * 10), and Pages attaches response headers from a `_headers` file in the
 * deployed directory. So this test runs the real production build and reads
 * the `_headers` file that build produces, the same file Pages serves.
 *
 * "Does not block any script host the application currently depends on" is
 * judged against that same build: every script index.html loads, and every
 * absolute script URL the bundled code can inject (the AdSense loader today;
 * Maps once Issue #8 lands), must be allowed by the policy's script-src. A
 * host added later without updating the policy fails here, which is the
 * automated check the last criterion asks for.
 *
 * Out of scope: other security headers (HSTS, X-Frame-Options), and whether
 * the policy is enforced. Enforcement is a later decision on the Issue.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontend = path.join(repositoryRoot, "apps", "web", "frontend");
const dist = path.join(frontend, "dist");

// Production build, reading the API base URL the CI workflow also supplies.
const BUILD_TIMEOUT_MS = 180_000;

beforeAll(() => {
  const result = spawnSync(
    "bun",
    ["run", "--filter", "@zipnami/web-frontend", "build"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8787" },
      timeout: BUILD_TIMEOUT_MS,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `production build failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}, BUILD_TIMEOUT_MS);

/**
 * The headers Cloudflare Pages attaches to `/`, from the built `_headers`
 * file: an unindented line names a path pattern, and the indented
 * `Name: value` lines under it are that pattern's headers.
 */
const headersForRoot = (): Map<string, string> => {
  const file = path.join(dist, "_headers");
  const headers = new Map<string, string>();

  if (!existsSync(file)) return headers;

  let applies = false;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      const pattern = line.trim();
      applies = pattern === "/*" || pattern === "/";
      continue;
    }
    const separator = line.indexOf(":");
    // A header line without a name and value is a malformed rule, not one
    // to skip (Issue #73): Pages would not serve what it seems to say.
    if (separator <= 0) {
      throw new Error(`malformed _headers line: ${JSON.stringify(line)}`);
    }
    if (!applies) continue;
    headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim(),
    );
  }

  return headers;
};

/** The policy served for `/`, report-only or enforced. */
const servedPolicy = (): string | undefined => {
  const headers = headersForRoot();
  return (
    headers.get("content-security-policy-report-only") ??
    headers.get("content-security-policy")
  );
};

/** The source list of `directive`, falling back to default-src as CSP does. */
const sourcesFor = (policy: string, directive: string): string[] => {
  // CSP uses the first occurrence of a repeated directive and ignores the
  // rest (Issue #73), so a later duplicate must not decide the outcome.
  const directives = new Map<string, string[]>();
  for (const [name, ...sources] of policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .filter(([name]) => name !== undefined && name !== "")) {
    const key = name.toLowerCase();
    if (!directives.has(key)) directives.set(key, sources);
  }
  return directives.get(directive) ?? directives.get("default-src") ?? [];
};

/**
 * Whether a script at `url` may load under `sources`, for a page served from
 * an https Pages origin. Covers the source forms a static allowlist uses:
 * 'self', a scheme, and a host with an optional leading `*.` wildcard,
 * compared case-insensitively, as browsers do.
 *
 * It fails closed (Issue #73): `*`, `https://*`, and any source form it does
 * not recognize count as allowing everything. Treating an unknown form as
 * allowing nothing used to let a broad source such as `https://*` pass the
 * "unlisted host" test while a browser allowed every https host.
 */
/**
 * CSP scheme-part matching (CSP3): a scheme matches itself; http: also
 * matches https:; ws: also matches wss:, http:, and https:; and wss: also
 * matches https:. So ws: and wss: can allow https scripts too.
 */
const upgradesTo: Record<string, string[]> = {
  "http:": ["https:"],
  "ws:": ["wss:", "http:", "https:"],
  "wss:": ["https:"],
};

const schemeMatches = (source: string, protocol: string): boolean =>
  source === protocol || (upgradesTo[source] ?? []).includes(protocol);

const allows = (sources: string[], url: string): boolean => {
  const target = new URL(url, "https://site.pages.dev/");

  return sources.some((raw) => {
    const source = raw.toLowerCase();

    if (source === "*") return true;
    if (source === "'self'") return target.origin === "https://site.pages.dev";
    // Other keywords ('none', 'unsafe-inline', nonces, hashes) allow no URL.
    if (source.startsWith("'")) return false;
    // A scheme source such as https: allows every host on that scheme. CSP
    // also lets an insecure scheme match its secure upgrade, so http:
    // allows https: URLs too (scheme-part matching).
    if (/^[a-z][a-z0-9+.-]*:$/.test(source)) {
      return schemeMatches(source, target.protocol);
    }

    const match =
      /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([a-z0-9.-]+|\*)(?::(?:\d+|\*))?(\/\S*)?$/.exec(
        source,
      );
    if (match === null) return true;
    const [, scheme, wildcard, host] = match;
    if (host === "*") return true;
    if (scheme !== undefined && !schemeMatches(`${scheme}:`, target.protocol)) {
      return false;
    }
    return wildcard === undefined
      ? target.hostname === host
      : target.hostname.endsWith(`.${host}`);
  });
};

/** Every script the production build loads or can inject. */
const scriptsTheBuildUses = (): string[] => {
  const indexHtml = readFileSync(path.join(dist, "index.html"), "utf8");
  const fromHtml = [
    ...indexHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g),
  ].map(([, src]) => src);

  const assets = path.join(dist, "assets");
  const fromBundles = readdirSync(assets)
    .filter((name) => name.endsWith(".js"))
    .flatMap((name) => [
      ...readFileSync(path.join(assets, name), "utf8").matchAll(
        /https:\/\/[A-Za-z0-9.-]+\/[^"'`\s]*?\.js\b/g,
      ),
    ])
    .map(([url]) => url);

  return [...new Set([...fromHtml, ...fromBundles])];
};

describe("Issue #38: a Content-Security-Policy restricting script sources", () => {
  test("a Content-Security-Policy is served with the production Web frontend response (report-only first)", () => {
    const policy = servedPolicy();

    expect(
      policy,
      "the build's _headers serves no policy for /*",
    ).toBeDefined();
    // It restricts scripts: a policy without script-src or default-src
    // would leave them unrestricted.
    expect(sourcesFor(policy ?? "", "script-src")).not.toEqual([]);
  });

  test("the policy's script-src explicitly allows the AdSense loader host", () => {
    const sources = sourcesFor(servedPolicy() ?? "", "script-src");
    const loader = scriptsTheBuildUses().find((url) =>
      /adsbygoogle\.js$/.test(url),
    );

    expect(
      loader,
      "the build no longer references the AdSense loader",
    ).toBeDefined();
    expect(allows(sources, loader as string)).toBe(true);
    // Explicitly: by its host, not through a blanket source. Any single
    // source that would also allow an arbitrary unlisted host is blanket,
    // whatever its spelling (HTTPS:, *, https://*) (Issue #73).
    expect(
      sources.filter((source) =>
        allows([source], "https://scripts.example.invalid/x.js"),
      ),
    ).toEqual([]);
  });

  test("the policy blocks no script host the production build depends on", () => {
    const sources = sourcesFor(servedPolicy() ?? "", "script-src");
    const blocked = scriptsTheBuildUses().filter(
      (url) => !allows(sources, url),
    );

    expect(scriptsTheBuildUses().length).toBeGreaterThan(1);
    expect(blocked).toEqual([]);
  });

  test("the policy still restricts scripts: an unlisted host is not allowed", () => {
    // Without this, a policy that allowed everything would pass the two
    // tests above while restricting nothing.
    const sources = sourcesFor(servedPolicy() ?? "", "script-src");

    expect(allows(sources, "https://scripts.example.invalid/x.js")).toBe(false);
    expect(sourcesFor(servedPolicy() ?? "", "object-src")).toEqual(["'none'"]);
  });
});
