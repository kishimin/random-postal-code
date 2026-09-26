import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Acceptance tests live at the repository root because they describe the whole
  // system, not this package. Both roots are scanned from here so a single
  // command runs the outer ATDD loop and this package's own E2E tests.
  //
  // acceptance/ can hold acceptance tests that are not browser tests: Issue
  // #3's runs under Vitest (ADR-0062 identifies an AT by its location, not by
  // which runner executes it), and Playwright cannot even load that file
  // (it imports "vitest", which is not on this package's dependency graph).
  // The browser acceptance tests are named explicitly instead of matched
  // by a directory glob so a future non-browser AT does not have to be
  // excluded here again. No CI check currently catches a renamed or removed
  // entry here — the "Check that no acceptance test was modified" step only
  // diffs files inside acceptance/ against the merge base, and this file
  // lives outside it — so edit this list carefully.
  testDir: "../../..",
  testMatch: [
    "acceptance/frontend-foundation.medium.test.ts",
    "acceptance/error-destinations.medium.test.ts",
    "acceptance/random-postal-code-experience.medium.test.ts",
    "acceptance/web-advertising-boundary.medium.test.ts",
    "acceptance/privacy-and-attribution.medium.test.ts",
    "acceptance/web-responsive-accessibility.medium.test.ts",
    "apps/web/frontend/e2e/tests/**/*.test.ts",
  ],
  fullyParallel: false,
  workers: 5,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
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
  ],
  webServer: [
    {
      command: "bun run preview",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run storybook -- --ci",
      url: "http://localhost:6006",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
