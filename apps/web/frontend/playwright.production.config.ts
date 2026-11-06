import { defineConfig, devices } from "@playwright/test";

/*
 * The production tests (Issue #104), run by the Deploy workflow after both
 * halves are deployed:
 * `PRODUCTION_BASE_URL=https://<project>.pages.dev bun run e2e:production`.
 *
 * Separate from playwright.config.ts on purpose. That config starts local
 * servers and stubs the API; this one starts nothing and stubs nothing but
 * the advertising, consent, and Analytics hosts (e2e/production/fixtures.ts),
 * so a pass means the deployed Pages site really reached the deployed Worker.
 */
const baseURL = process.env.PRODUCTION_BASE_URL;

if (baseURL === undefined || baseURL === "") {
  throw new Error(
    "PRODUCTION_BASE_URL must name the deployed Pages site, for example https://<project>.pages.dev",
  );
}

export default defineConfig({
  testDir: "./e2e/production",
  testMatch: "**/*.large.test.ts",
  // Always, not only on CI: a focused test left in would silently skip
  // the rest of the gate after a deploy.
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  // One retry absorbs a cold start right after deploying; a second failure
  // is a real one.
  retries: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // A service worker's requests bypass Playwright's routing, which would
    // let a blocked host through.
    serviceWorkers: "block",
    // Copying is checked on the real clipboard.
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "Chromium", use: { ...devices["Desktop Chrome"] } }],
});
