import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #72, policy side: the served policy names the
 * reporting endpoint, by `report-to` with a `report-uri` fallback.
 * acceptance/csp-report-endpoint.medium.test.ts holds the Worker side.
 *
 * The endpoint lives on the Worker, whose URL each build is given through
 * VITE_API_BASE_URL (design.md section 12 fixes it only once provisioned).
 * So the policy can only name it in the build output, and this test reads
 * the `_headers` file the real production build writes, the one Pages
 * serves.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const dist = path.join(repositoryRoot, "apps", "web", "frontend", "dist");

const API_BASE_URL = "http://127.0.0.1:8787";
const REPORT_ENDPOINT = `${API_BASE_URL}/api/csp-report`;
const BUILD_TIMEOUT_MS = 180_000;

beforeAll(() => {
  const result = spawnSync(
    "bun",
    ["run", "--filter", "@zipnami/web-frontend", "build"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, VITE_API_BASE_URL: API_BASE_URL },
      timeout: BUILD_TIMEOUT_MS,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `production build failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}, BUILD_TIMEOUT_MS);

/** Header name (lowercase) to value, for the `/*` rule of dist/_headers. */
const rootHeaders = (): Map<string, string> => {
  const headers = new Map<string, string>();
  let applies = false;
  for (const line of readFileSync(path.join(dist, "_headers"), "utf8").split(
    /\r?\n/,
  )) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      applies = line.trim() === "/*";
      continue;
    }
    const separator = line.indexOf(":");
    if (applies && separator > 0) {
      headers.set(
        line.slice(0, separator).trim().toLowerCase(),
        line.slice(separator + 1).trim(),
      );
    }
  }
  return headers;
};

const directive = (policy: string, name: string): string[] | undefined =>
  policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([directiveName]) => directiveName?.toLowerCase() === name)
    ?.slice(1);

describe("Issue #72: the served policy names its reporting endpoint", () => {
  test("the policy reports through report-to, with a report-uri fallback, to the Worker's endpoint", () => {
    const headers = rootHeaders();
    const policy =
      headers.get("content-security-policy-report-only") ??
      headers.get("content-security-policy") ??
      "";

    // report-uri: the endpoint URL itself.
    expect(directive(policy, "report-uri")).toEqual([REPORT_ENDPOINT]);

    // report-to: a group name, defined by Reporting-Endpoints as the same
    // endpoint.
    const group = directive(policy, "report-to")?.[0];
    expect(group, "the policy has no report-to").toBeDefined();
    expect(headers.get("reporting-endpoints") ?? "").toContain(
      `${group}="${REPORT_ENDPOINT}"`,
    );
  });
});
