import { defineConfig, devices } from "@playwright/test";

/*
 * The production smoke check (Issue #19), run by the Deploy workflow after
 * both halves are deployed: `SMOKE_BASE_URL=https://<project>.pages.dev bun
 * run smoke:production`.
 *
 * Separate from playwright.config.ts on purpose. That config starts local
 * servers and stubs the API; this one starts nothing and stubs nothing, so
 * a pass means the deployed Pages site really reached the deployed Worker.
 */
const baseURL = process.env.SMOKE_BASE_URL;

if (baseURL === undefined || baseURL === "") {
  throw new Error(
    "SMOKE_BASE_URL must name the deployed Pages site, for example https://<project>.pages.dev",
  );
}

export default defineConfig({
  testDir: "./e2e/smoke",
  testMatch: "**/*.smoke.ts",
  fullyParallel: false,
  workers: 1,
  // One retry absorbs a cold start right after deploying; a second failure
  // is a real one.
  retries: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "Chromium", use: { ...devices["Desktop Chrome"] } }],
});
