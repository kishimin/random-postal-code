import {
  devices,
  type PlaywrightTestOptions,
  type PlaywrightWorkerOptions,
  type Project,
} from "@playwright/test";

/*
 * The six browsers Zipnami is tested and shown in.
 *
 * Shared by playwright.config.ts, which proves the site works in them, and
 * playwright.recording.config.ts, which records the v1.0.0 demo in them
 * (Issue #132). Kept in one list so the video cannot show a browser CI never
 * ran, or leave out one it did.
 */
export const browserProjects: Project<
  PlaywrightTestOptions,
  PlaywrightWorkerOptions
>[] = [
  {
    name: "Google Chrome",
    use: { ...devices["Desktop Chrome"], channel: "chrome" },
  },
  {
    name: "Microsoft Edge",
    use: { ...devices["Desktop Edge"], channel: "msedge" },
  },
  {
    name: "Safari",
    use: { ...devices["Desktop Safari"] },
  },
  {
    name: "Android (Chrome)",
    use: { ...devices["Pixel 7"] },
  },
  {
    name: "iPhone (Safari)",
    use: { ...devices["iPhone 15"] },
  },
  // Issue #132 adds Firefox so the v1.0.0 demo can show the site in six
  // browsers that CI has actually proven, not five plus one that was only
  // tried by hand.
  {
    name: "Firefox",
    // The descriptor only sets defaultBrowserType, which Playwright falls
    // back to. browserName is stated as well so the browser this project
    // launches is read from the field Playwright resolves first, and from
    // the field acceptance/firefox-browser-project.medium.test.ts reads.
    use: { ...devices["Desktop Firefox"], browserName: "firefox" },
  },
];
