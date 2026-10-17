import { afterEach, describe, expect, test, vi } from "vitest";
import worker from "../apps/web/backend/src/index.ts";

/*
 * Acceptance test for Issue #72: Collect Content-Security-Policy violation
 * reports from production. This file holds the Worker side: the endpoint
 * that receives reports. acceptance/csp-report-policy.medium.test.ts holds
 * the policy side, which names the endpoint.
 *
 * Each test name states the acceptance criterion it holds.
 *
 * Browsers send reports in two shapes, and both are exercised:
 * - `report-uri`: one JSON object under "csp-report", sent as
 *   application/csp-report;
 * - `report-to` (Reporting API): a JSON array of reports, each with
 *   `type: "csp-violation"` and a `body`, sent as application/reports+json.
 *
 * "Appears in the Worker's structured logs" is observed through console.log,
 * which is where Workers Logs (observability, wrangler.jsonc) reads from;
 * request-log.ts writes request entries the same way.
 */

const API_ORIGIN = "https://zipnami-api.example.workers.dev";
const PAGES_ORIGIN = "https://zipnami.pages.dev";
const REPORT_PATH = "/api/csp-report";

const env = { ALLOWED_ORIGINS: PAGES_ORIGIN };
const ctx = {
  waitUntil: (promise: Promise<unknown>) => void promise,
  passThroughOnException: () => undefined,
  props: {},
};

type WorkerFetchArguments = Parameters<typeof worker.fetch>;

const respond = async (request: Request): Promise<Response> =>
  await worker.fetch(
    request as WorkerFetchArguments[0],
    env as WorkerFetchArguments[1],
    ctx as unknown as WorkerFetchArguments[2],
  );

const post = (contentType: string, body: string) =>
  new Request(`${API_ORIGIN}${REPORT_PATH}`, {
    method: "POST",
    headers: { "content-type": contentType, origin: PAGES_ORIGIN },
    body,
  });

const BLOCKED = "https://scripts.example.invalid/injected.js";

const legacyReport = JSON.stringify({
  "csp-report": {
    "document-uri": `${PAGES_ORIGIN}/privacy`,
    "violated-directive": "script-src",
    "effective-directive": "script-src",
    "blocked-uri": BLOCKED,
    disposition: "report",
  },
});

const reportingApiReports = JSON.stringify([
  {
    type: "csp-violation",
    age: 10,
    url: `${PAGES_ORIGIN}/`,
    user_agent: "test",
    body: {
      documentURL: `${PAGES_ORIGIN}/`,
      effectiveDirective: "script-src-elem",
      blockedURL: BLOCKED,
      disposition: "report",
    },
  },
]);

/** Every structured log entry written while `run` executes. */
const loggedDuring = async (
  run: () => Promise<Response>,
): Promise<{ response: Response; entries: unknown[] }> => {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  try {
    const response = await run();
    // Logs may be written through waitUntil after the response returns.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      response,
      entries: lines.flatMap((line) => {
        try {
          return [JSON.parse(line) as unknown];
        } catch {
          return [];
        }
      }),
    };
  } finally {
    spy.mockRestore();
  }
};

const violationEntries = (entries: unknown[]) =>
  entries.filter((entry) => JSON.stringify(entry).includes(BLOCKED));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Issue #72: the Worker collects CSP violation reports", () => {
  test.each([
    [
      "report-uri (application/csp-report)",
      "application/csp-report",
      legacyReport,
    ],
    [
      "report-to (application/reports+json)",
      "application/reports+json",
      reportingApiReports,
    ],
  ])(
    "a browser-format CSP violation report sent as %s is accepted and logged, not echoed",
    async (_shape, contentType, body) => {
      const { response, entries } = await loggedDuring(() =>
        respond(post(contentType, body)),
      );

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      // Nothing of the report comes back to the sender.
      expect(await response.text()).not.toContain(BLOCKED);
      // The blocked URL and the directive reach the structured logs.
      const logged = violationEntries(entries);
      expect(logged).toHaveLength(1);
      expect(JSON.stringify(logged[0])).toMatch(/script-src/);
    },
  );

  test("an oversized report body is rejected and not logged", async () => {
    const huge = JSON.stringify({
      "csp-report": { "blocked-uri": BLOCKED, padding: "x".repeat(200_000) },
    });
    const { response, entries } = await loggedDuring(() =>
      respond(post("application/csp-report", huge)),
    );

    expect(response.status).toBe(413);
    expect(violationEntries(entries)).toEqual([]);
  });

  test.each(["text/plain", "application/json", "text/html"])(
    "a body that is not a CSP report (%s) is rejected and not logged",
    async (contentType) => {
      const { response, entries } = await loggedDuring(() =>
        respond(post(contentType, legacyReport)),
      );

      expect(response.status).toBe(415);
      expect(violationEntries(entries)).toEqual([]);
    },
  );

  test("the Pages origin may preflight a report-to delivery, and nothing else opens", async () => {
    const preflight = (path: string, method: string) =>
      respond(
        new Request(`${API_ORIGIN}${path}`, {
          method: "OPTIONS",
          headers: {
            origin: PAGES_ORIGIN,
            "access-control-request-method": method,
            "access-control-request-headers": "content-type",
          },
        }),
      );

    const reportPreflight = await preflight(REPORT_PATH, "POST");
    expect(reportPreflight.headers.get("access-control-allow-origin")).toBe(
      PAGES_ORIGIN,
    );
    expect(
      reportPreflight.headers.get("access-control-allow-methods") ?? "",
    ).toMatch(/\bPOST\b/);
    expect(
      (
        reportPreflight.headers.get("access-control-allow-headers") ?? ""
      ).toLowerCase(),
    ).toContain("content-type");

    // GET /api/random keeps exactly its read-only preflight.
    const randomPreflight = await preflight("/api/random", "POST");
    expect(
      randomPreflight.headers.get("access-control-allow-methods") ?? "",
    ).not.toMatch(/\bPOST\b/);
  });

  test("GET /api/random is unchanged", async () => {
    const response = await respond(
      new Request(`${API_ORIGIN}/api/random`, {
        headers: { origin: PAGES_ORIGIN },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      PAGES_ORIGIN,
    );
    expect(await response.json()).toHaveProperty("postalCode");
  });
});
