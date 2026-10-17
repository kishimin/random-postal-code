import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #39: Implement consent-gating before eligible
 * AdSense requests.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What the repository can and cannot observe
 * ------------------------------------------
 * The consent platform is Google Privacy & messaging (decided on Issue #39,
 * 2026-10-17; recorded in design.md section 12). With it, the consent message
 * and the gating of ad requests are carried out by Google's own AdSense tag
 * once a "European regulations" message is published in the AdSense account,
 * and declining personalization falls back to non-personalized or limited ads
 * through IAB TCF. Whether a visitor in a consent region actually sees the
 * message before an ad request is a property of that account and of Google's
 * tag in production. A browser here cannot be placed in such a region (the
 * same reason Issue #9 routed these criteria to human review, ADR-0019), so
 * that is confirmed against production, as design.md section 12 requires.
 *
 * What this test holds is the repository's side of that contract, against the
 * real production build:
 * - nothing in the shipped code pre-empts the platform's decision, by pausing
 *   or forcing non-personalized ad requests itself;
 * - the script policy Pages serves lets the platform's script load;
 * - the privacy disclosure tells visitors which mechanism asks for consent and
 *   what declining means;
 * - the deployment runbook makes publishing the message part of setting up
 *   production, so it cannot be skipped silently.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const dist = path.join(repositoryRoot, "apps", "web", "frontend", "dist");

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

/** Every JavaScript file the production build ships, as one text. */
const shippedCode = (): string => {
  const assets = path.join(dist, "assets");
  return readdirSync(assets)
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(path.join(assets, name), "utf8"))
    .join("\n");
};

/** The script-src sources Pages serves for `/`, report-only or enforced. */
const servedScriptSources = (): string[] => {
  const lines = readFileSync(path.join(dist, "_headers"), "utf8").split(
    /\r?\n/,
  );
  const policy = lines
    .map((line) => line.trim())
    .map((line) =>
      /^content-security-policy(?:-report-only)?:\s*(.*)$/i.exec(line),
    )
    .find((match) => match !== null)?.[1];
  const scriptSrc = (policy ?? "")
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([name]) => name?.toLowerCase() === "script-src");
  return scriptSrc?.slice(1) ?? [];
};

// Google Privacy & messaging serves its consent message from this host.
const CONSENT_PLATFORM_HOST = "fundingchoicesmessages.google.com";

describe("Issue #39: consent gating through Google Privacy & messaging", () => {
  test("regions requiring consent complete the Google CMP flow before eligible ad requests: nothing in the shipped code pre-empts it", () => {
    // pauseAdRequests and requestNonPersonalizedAds are the adsbygoogle
    // switches a site would use to gate or downgrade requests itself. With
    // Google's platform deciding per visitor, setting either here would
    // override that decision for everyone.
    expect(shippedCode()).not.toMatch(
      /pauseAdRequests|requestNonPersonalizedAds/,
    );
  });

  test("the served script policy lets the consent platform's script load", () => {
    const sources = servedScriptSources();

    expect(sources).not.toEqual([]);
    expect(
      sources.some(
        (source) =>
          source === `https://${CONSENT_PLATFORM_HOST}` ||
          source === "https://*.google.com",
      ),
    ).toBe(true);
  });

  test("the privacy disclosure names the consent mechanism and what declining personalization means", () => {
    const code = shippedCode();

    // Google's platform, by name, and the regions it asks in.
    expect(code).toMatch(/プライバシーとメッセージ/);
    expect(code).toMatch(/欧州経済領域|EEA/);
    // Declining personalization falls back, rather than blocking the site.
    expect(code).toMatch(/パーソナライズされていない広告/);
    expect(code).toMatch(/制限付き広告/);
    // The disclosure no longer says the mechanism is missing.
    expect(code).not.toMatch(
      /同意管理の仕組みは、本サービスでは現時点で未導入/,
    );
  });

  test("declined personalization uses a non-personalized or limited mode: the runbook sets it up before production", () => {
    const runbook = readFileSync(
      path.join(repositoryRoot, "docs", "deployment.md"),
      "utf8",
    );
    const setup = runbook.slice(
      runbook.indexOf("## One-time setup"),
      runbook.indexOf("## Deploying"),
    );

    // Publishing the message belongs to setting up production, before the
    // first deploy, in the section a maintainer follows.
    expect(setup).toMatch(/Privacy & messaging/);
    expect(setup).toMatch(/European regulations/);
    expect(setup).toMatch(/limited ads/i);
  });
});
