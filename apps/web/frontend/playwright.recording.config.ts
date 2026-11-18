import { homedir } from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import { browserProjects } from "./playwright.projects.ts";

/*
 * Records the v1.0.0 demo journey in all six browsers (Issue #132, step 3):
 * `bun run record:demo`.
 *
 * Not a test config. It runs one journey per browser against production and
 * keeps a video of each, for the editing script to join into one video. It
 * still takes the browser from e2e/production/fixtures.ts, so the AdSense,
 * consent, and Analytics hosts are aborted before the first navigation and the
 * recording neither requests an ad nor records a visit (#106).
 *
 * Production, not a local build: the video shows the site people will visit,
 * with the real Worker and the real map (Issue #132's Out of scope).
 */
const baseURL = process.env.RECORDING_BASE_URL ?? "https://zipnami.pages.dev";

// Outside git: the raw videos are large and are rebuilt, not reviewed.
const outputDir =
  process.env.RECORDING_OUTPUT_DIR ??
  path.join(homedir(), ".zipnami-media", "v1.0.0", "recordings");

// Playwright's default scales every video down to fit 800x800, which leaves a
// desktop take too small for the final video. Each browser is recorded at its
// own viewport instead; the editing script fits them onto one canvas.
const recordedProjects = browserProjects.map((project) => ({
  ...project,
  use: {
    ...project.use,
    video: { mode: "on" as const, size: project.use?.viewport ?? undefined },
    // Without it, a click and the screen it opens follow each other faster
    // than a viewer can see what was clicked.
    launchOptions: { slowMo: 250 },
  },
}));

export default defineConfig({
  testDir: "./e2e/recording",
  testMatch: "**/*.recording.ts",
  outputDir,
  forbidOnly: true,
  // One browser at a time, so each journey runs at the pace a person would
  // see, not slowed by five others competing for the machine.
  fullyParallel: false,
  workers: 1,
  // A failed take is re-recorded by running the command again, not retried
  // into a second video beside the first.
  retries: 0,
  // The journey pauses on every screen, so it takes far longer than a test.
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL,
    trace: "off",
    // A service worker's requests bypass Playwright's routing, which would
    // let a blocked host through.
    serviceWorkers: "block",
  },
  projects: recordedProjects,
});
