import { describe, expect, test } from "vitest";
import type { AnalyticsHost } from "../features/analytics/google-analytics";
import { startGoogleAnalytics } from "./start-google-analytics";

const MEASUREMENT_ID = "G-ABC123DEF4";

/**
 * A page that never loads what it is given. A detached document has no
 * browsing context, so an appended script is only recorded and no request
 * reaches Google from the test browser.
 * @returns {AnalyticsHost} A document and a window that are not the test's own.
 */
const createHost = (): AnalyticsHost => ({
  document: document.implementation.createHTMLDocument(""),
  window: {},
});

describe("startGoogleAnalytics", () => {
  test("installs the tag for the measurement ID in the build environment", () => {
    const host = createHost();

    startGoogleAnalytics(
      {
        VITE_API_BASE_URL: "https://api.example.com",
        VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID: MEASUREMENT_ID,
      },
      host,
    );

    expect(Array.from(host.document.scripts, (script) => script.src)).toEqual([
      `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`,
    ]);
  });

  test("loads nothing for a build environment without a measurement ID", () => {
    const host = createHost();

    startGoogleAnalytics({ VITE_API_BASE_URL: "https://api.example.com" }, host);

    expect(host.document.scripts).toHaveLength(0);
  });

  // design.md section 7: Analytics is optional, so whatever goes wrong
  // installing it must not stop the application from starting.
  test("does not throw when the tag cannot be installed", () => {
    const host: AnalyticsHost = {
      document: document.implementation.createHTMLDocument(""),
      window: Object.defineProperty({}, "dataLayer", {
        get: () => {
          throw new Error("a page that refuses the data layer");
        },
      }),
    };

    expect(() =>
      startGoogleAnalytics(
        {
          VITE_API_BASE_URL: "https://api.example.com",
          VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID: MEASUREMENT_ID,
        },
        host,
      ),
    ).not.toThrow();
  });
});
