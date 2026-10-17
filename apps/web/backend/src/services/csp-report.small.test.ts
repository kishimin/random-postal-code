import { describe, expect, test } from "vitest";
import { cspViolationsIn, isCspReportMediaType } from "./csp-report.ts";

const BLOCKED = "https://scripts.example.invalid/injected.js";

describe("isCspReportMediaType", () => {
  test.each([
    "application/csp-report",
    "application/reports+json",
    "Application/CSP-Report",
    "application/reports+json; charset=utf-8",
  ])("accepts %s", (contentType) => {
    expect(isCspReportMediaType(contentType)).toBe(true);
  });

  test.each([undefined, "", "application/json", "text/plain", "text/html"])(
    "refuses %s",
    (contentType) => {
      expect(isCspReportMediaType(contentType)).toBe(false);
    },
  );
});

describe("cspViolationsIn", () => {
  test("reads a report-uri report", () => {
    expect(
      cspViolationsIn(
        "application/csp-report",
        JSON.stringify({
          "csp-report": {
            "document-uri": "https://zipnami.pages.dev/privacy",
            "effective-directive": "script-src",
            "blocked-uri": BLOCKED,
            disposition: "report",
          },
        }),
      ),
    ).toEqual([
      {
        documentURL: "https://zipnami.pages.dev/privacy",
        effectiveDirective: "script-src",
        blockedURL: BLOCKED,
        disposition: "report",
      },
    ]);
  });

  test("falls back to violated-directive when effective-directive is absent", () => {
    const [violation] =
      cspViolationsIn(
        "application/csp-report",
        JSON.stringify({
          "csp-report": {
            "violated-directive": "script-src-elem",
            "blocked-uri": BLOCKED,
          },
        }),
      ) ?? [];

    expect(violation?.effectiveDirective).toBe("script-src-elem");
  });

  test("reads every csp-violation in a Reporting API batch and skips other report types", () => {
    const violations = cspViolationsIn(
      "application/reports+json",
      JSON.stringify([
        {
          type: "csp-violation",
          body: {
            documentURL: "https://zipnami.pages.dev/",
            effectiveDirective: "script-src-elem",
            blockedURL: BLOCKED,
            disposition: "report",
          },
        },
        { type: "deprecation", body: { id: "x" } },
      ]),
    );

    expect(violations).toEqual([
      {
        documentURL: "https://zipnami.pages.dev/",
        effectiveDirective: "script-src-elem",
        blockedURL: BLOCKED,
        disposition: "report",
      },
    ]);
  });

  // A visitor's address bar can carry anything after "?" or "#"; the log
  // keeps only where the violation happened, not what was in the URL.
  test("drops the query and fragment from document and blocked URLs", () => {
    const [violation] =
      cspViolationsIn(
        "application/csp-report",
        JSON.stringify({
          "csp-report": {
            "document-uri":
              "https://zipnami.pages.dev/privacy?token=secret#top",
            "effective-directive": "script-src",
            "blocked-uri": `${BLOCKED}?session=abc`,
          },
        }),
      ) ?? [];

    expect(violation?.documentURL).toBe("https://zipnami.pages.dev/privacy");
    expect(violation?.blockedURL).toBe(BLOCKED);
  });

  test("keeps a non-URL blocked value such as inline as it is", () => {
    const [violation] =
      cspViolationsIn(
        "application/csp-report",
        JSON.stringify({
          "csp-report": {
            "blocked-uri": "inline",
            "effective-directive": "script-src",
          },
        }),
      ) ?? [];

    expect(violation?.blockedURL).toBe("inline");
  });

  test.each([
    ["malformed JSON", "application/csp-report", "{"],
    ["a report-uri body without csp-report", "application/csp-report", "{}"],
    [
      "a Reporting API body that is not an array",
      "application/reports+json",
      "{}",
    ],
  ])("returns undefined for %s", (_case, contentType, body) => {
    expect(cspViolationsIn(contentType, body)).toBeUndefined();
  });

  test("truncates very long field values so one report cannot flood the log", () => {
    const [violation] =
      cspViolationsIn(
        "application/csp-report",
        JSON.stringify({
          "csp-report": {
            "blocked-uri": "inline",
            "effective-directive": "x".repeat(5000),
          },
        }),
      ) ?? [];

    expect(violation?.effectiveDirective.length).toBeLessThanOrEqual(200);
  });
});
