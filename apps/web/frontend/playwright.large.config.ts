import { defineConfig, devices } from "@playwright/test";

/*
 * The Large browser tests (Issue #21): a production build of the site talking
 * to a real Worker, with nothing stubbed on the GET /api/random path.
 *
 * Why this is its own config rather than more entries in playwright.config.ts
 * ---------------------------------------------------------------------------
 * playwright.config.ts is the Medium runner. Its page is a preview of a build
 * whose API origin is a placeholder nobody listens on, because every Medium
 * test answers the API itself. Adding a Worker there would make every pull
 * request start wrangler dev for tests that never call it, and the Worker
 * origin allowlist would be one more thing that can fail a required check for
 * a reason unrelated to the change. A config of its own keeps the Medium job
 * exactly as fast and as isolated as it was, and lets this one name the two
 * processes it really needs.
 *
 * Why the build happens inside the web server command
 * ---------------------------------------------------
 * VITE_API_BASE_URL is baked into the bundle at build time. A build made
 * earlier for some other purpose would point at the wrong Worker and fail
 * with a CORS or connection error that says nothing about the cause, so this
 * config builds with the values it needs instead of trusting what is in dist/.
 *
 * Third parties are never reached: the tests refuse every non-local host, so
 * the Maps key below only has to be non-empty (it makes the build take the
 * path a deployment takes) and is not a credential.
 */

const siteOrigin = "http://localhost:4173";
const workerOrigin = "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "../../..",
  testMatch: ["acceptance/web-mvp-end-to-end.large.test.ts"],
  fullyParallel: false,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL: siteOrigin,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "WebKit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: [
    {
      // ALLOWED_ORIGINS names exactly the page origin, so the test can show
      // that the next port over is refused.
      command:
        "bunx wrangler dev --port 8787 --var ALLOWED_ORIGINS:" + siteOrigin,
      cwd: "../backend",
      url: workerOrigin + "/api/random",
      // Never reuse: a Worker left running with another allowlist would make
      // the CORS assertions describe a different configuration.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "bunx vite build && bunx vite preview --port 4173 --strictPort",
      url: siteOrigin,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        VITE_API_BASE_URL: workerOrigin,
        VITE_GOOGLE_MAPS_API_KEY: "large-test-placeholder-maps-key",
      },
    },
  ],
});
