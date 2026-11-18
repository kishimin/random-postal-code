import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #132, criterion 3: "One command records the
 * journey in all six browsers, and while it runs, no request reaches the
 * AdSense SDK or Google Analytics."
 *
 * Each test name states the part of the criterion it holds, so a failure names
 * the part that broke rather than only the assertion.
 *
 * What is and is not exercised here
 * ---------------------------------
 * The recording runs against production, so CI does not run it: a pull
 * request must not depend on, or send traffic to, the deployed site. This test
 * holds what makes the one command correct and safe instead:
 *
 * - the frontend has one script that runs the recording config;
 * - that config records exactly the six browsers playwright.config.ts tests,
 *   and keeps a video of every one;
 * - it records https://zipnami.pages.dev unless told otherwise;
 * - every journey it runs takes its browser from e2e/production/fixtures.ts.
 *   That fixture aborts the AdSense, consent, and Analytics hosts before the
 *   first navigation, and acceptance/production-tests-third-party-block
 *   .medium.test.ts (Issue #104) proves it does, in a real browser. A journey
 *   that took its browser from @playwright/test directly would reach them.
 *
 * Running the command and getting six videos is shown on the pull request.
 * Editing, upload, and the X drafts (criteria 4 to 8) are not exercised here.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontendDirectory = path.join(repositoryRoot, "apps", "web", "frontend");

type Project = {
  name?: string;
  use?: { video?: string | { mode?: string } };
};
type Config = {
  testDir?: string;
  testMatch?: string | string[];
  use?: { baseURL?: string; video?: string | { mode?: string } };
  projects?: Project[];
};

const loadConfig = async (file: string): Promise<Config> => {
  const module = (await import(path.join(frontendDirectory, file))) as {
    default: Config;
  };

  return module.default;
};

const loadRecordingConfig = async (): Promise<Config> => {
  // The default, not whatever the machine running this happens to set.
  delete process.env.RECORDING_BASE_URL;

  return loadConfig("playwright.recording.config.ts");
};

const videoMode = (video: string | { mode?: string } | undefined) =>
  typeof video === "string" ? video : video?.mode;

const RECORDING_SCRIPT =
  /^playwright test (?:.* )?--config[ =]playwright\.recording\.config\.ts(?: |$)/;

const PRODUCTION_FIXTURE = /from\s+["']\.\.\/production\/fixtures(?:\.ts)?["']/;
const PLAYWRIGHT_TEST = /from\s+["']@playwright\/test["']/;

describe("Issue #132: one command records the demo journey", () => {
  test("the frontend has one script that runs playwright.recording.config.ts", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(frontendDirectory, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    const recording = Object.entries(manifest.scripts).filter(([, command]) =>
      RECORDING_SCRIPT.test(command),
    );

    expect(recording.map(([name]) => name)).toEqual(["record:demo"]);
  });

  test("the recording config records exactly the six browsers playwright.config.ts tests, Firefox among them", async () => {
    const tested = (await loadConfig("playwright.config.ts")).projects ?? [];
    const recorded = (await loadRecordingConfig()).projects ?? [];

    expect(recorded.map((project) => project.name)).toEqual(
      tested.map((project) => project.name),
    );
    expect(recorded).toHaveLength(6);
    expect(recorded.map((project) => project.name)).toContain("Firefox");
  });

  test("every browser's run keeps a video", async () => {
    const config = await loadRecordingConfig();

    const withoutVideo = (config.projects ?? [])
      .filter(
        (project) =>
          (videoMode(project.use?.video) ?? videoMode(config.use?.video)) !==
          "on",
      )
      .map((project) => project.name);

    expect(withoutVideo).toEqual([]);
  });

  test("it records https://zipnami.pages.dev unless told otherwise", async () => {
    expect((await loadRecordingConfig()).use?.baseURL).toBe(
      "https://zipnami.pages.dev",
    );
  });

  test("every journey it runs takes its browser from the production fixture that aborts AdSense, consent, and Analytics", async () => {
    const config = await loadRecordingConfig();
    const testDirectory = path.resolve(
      frontendDirectory,
      config.testDir ?? ".",
    );
    const journeys = readdirSync(testDirectory).filter((name) =>
      name.endsWith(".recording.ts"),
    );

    // Without this, a recording directory with no journey would pass
    // vacuously.
    expect(journeys.length, "no journey is recorded").toBeGreaterThan(0);
    expect(config.testMatch).toBe("**/*.recording.ts");

    const outcomes = journeys.map((name) => {
      const source = readFileSync(path.join(testDirectory, name), "utf8");

      return {
        name,
        usesBlockingFixture: PRODUCTION_FIXTURE.test(source),
        importsPlaywrightTestDirectly: PLAYWRIGHT_TEST.test(source),
      };
    });

    expect(outcomes).toEqual(
      journeys.map((name) => ({
        name,
        usesBlockingFixture: true,
        importsPlaywrightTestDirectly: false,
      })),
    );
  });
});
