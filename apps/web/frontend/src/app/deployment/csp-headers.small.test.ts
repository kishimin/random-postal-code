import { describe, expect, test } from "vitest";
import {
  CSP_REPORT_ENDPOINT_TOKEN,
  fillCspReportEndpoint,
} from "./csp-headers";

const template = [
  "/*",
  `  Reporting-Endpoints: csp-endpoint="${CSP_REPORT_ENDPOINT_TOKEN}"`,
  `  Content-Security-Policy-Report-Only: script-src 'self'; report-uri ${CSP_REPORT_ENDPOINT_TOKEN}; report-to csp-endpoint`,
  "",
].join("\n");

describe("fillCspReportEndpoint", () => {
  test("replaces every placeholder with the endpoint", () => {
    const filled = fillCspReportEndpoint(
      template,
      "https://api.example.workers.dev/api/csp-report",
    );

    expect(filled).toContain(
      'Reporting-Endpoints: csp-endpoint="https://api.example.workers.dev/api/csp-report"',
    );
    expect(filled).toContain(
      "report-uri https://api.example.workers.dev/api/csp-report;",
    );
    expect(filled).not.toContain(CSP_REPORT_ENDPOINT_TOKEN);
  });

  test("refuses a template without the placeholder, so a policy cannot silently lose its endpoint", () => {
    expect(() =>
      fillCspReportEndpoint("/*\n  X: y\n", "https://api.example/x"),
    ).toThrow(/placeholder/);
  });

  test.each([
    'https://api.example/x"; script-src *',
    "https://api.example/x y",
    "https://api.example/x\n  X-Injected: 1",
  ])(
    "refuses an endpoint that would break out of the header (%s)",
    (endpoint) => {
      expect(() => fillCspReportEndpoint(template, endpoint)).toThrow(
        /endpoint/,
      );
    },
  );
});
