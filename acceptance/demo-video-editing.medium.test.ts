import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #132, criterion 4: "One command builds one edited
 * video from the six recordings, with a Japanese caption naming the browser at
 * the start of each section, and a length of 2–4 minutes."
 *
 * Each test name states the part of the criterion it holds, so a failure names
 * the part that broke rather than only the assertion.
 *
 * What is and is not exercised here
 * ---------------------------------
 * The editing runs ffmpeg over the six recordings of production, which live
 * outside git (~/.zipnami-media), so CI cannot run it. This test holds what
 * decides the video instead:
 *
 * - the frontend has one script that runs the editing script;
 * - the edit plan the script encodes from has one section per browser that
 *   playwright.config.ts tests, in that order, and refuses to plan without
 *   all six;
 * - each section opens with a caption, in Japanese, that names its browser;
 * - for recordings of 20 to 40 seconds each (Issue #132, step 3), the planned
 *   video is 2 to 4 minutes long.
 *
 * Running the command and getting the video is shown on the pull request.
 * Upload and the X drafts (criteria 5 to 8) are not exercised here.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontendDirectory = path.join(repositoryRoot, "apps", "web", "frontend");

type Recording = { project: string; durationSeconds: number };
type Section = {
  project: string;
  startSeconds: number;
  durationSeconds: number;
  caption: { text: string; startSeconds: number; durationSeconds: number };
};
type Plan = { sections: Section[]; totalSeconds: number };
type PlanModule = { planDemoVideo: (recordings: Recording[]) => Plan };

const loadPlanner = async (): Promise<PlanModule["planDemoVideo"]> => {
  const module = (await import(
    path.join(frontendDirectory, "scripts", "demo-video-plan.ts")
  )) as PlanModule;

  return module.planDemoVideo;
};

const testedBrowsers = async (): Promise<string[]> => {
  const config = (await import(
    path.join(frontendDirectory, "playwright.config.ts")
  )) as { default: { projects?: { name?: string }[] } };

  return (config.default.projects ?? []).map((project) => project.name ?? "");
};

const recordingsOf = (browsers: string[], durationSeconds: number) =>
  browsers.map((project) => ({ project, durationSeconds }));

const EDITING_SCRIPT = /^bun (?:run )?scripts\/edit-demo-video\.ts(?: |$)/;

// Hiragana, katakana, or kanji: a caption with none of them is not Japanese.
const JAPANESE = /[぀-ヿ一-鿿]/u;

// The caption may describe the browser in Japanese, but the product name
// itself is what a viewer recognises, so it must appear.
const BROWSER_NAME: Record<string, string> = {
  "Google Chrome": "Chrome",
  "Microsoft Edge": "Edge",
  Safari: "Safari",
  "Android (Chrome)": "Android",
  "iPhone (Safari)": "iPhone",
  Firefox: "Firefox",
};

describe("Issue #132: one command builds the edited demo video", () => {
  test("the frontend has one script that runs the editing script", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(frontendDirectory, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    const editing = Object.entries(manifest.scripts).filter(([, command]) =>
      EDITING_SCRIPT.test(command),
    );

    expect(editing.map(([name]) => name)).toEqual(["edit:demo"]);
  });

  test("the video has one section per tested browser, in the order playwright.config.ts lists them", async () => {
    const browsers = await testedBrowsers();
    const plan = (await loadPlanner())(recordingsOf(browsers, 30));

    expect(browsers).toHaveLength(6);
    expect(plan.sections.map((section) => section.project)).toEqual(browsers);
  });

  test("the sections follow one another with no gap or overlap, and make up the whole video", async () => {
    const plan = (await loadPlanner())(
      recordingsOf(await testedBrowsers(), 30),
    );

    const starts = plan.sections.map((section) => section.startSeconds);
    const ends = plan.sections.map(
      (section) => section.startSeconds + section.durationSeconds,
    );

    expect(starts[0]).toBeCloseTo(0, 3);
    starts.slice(1).forEach((start, index) => {
      expect(start).toBeCloseTo(ends[index] ?? Number.NaN, 3);
    });
    expect(plan.totalSeconds).toBeCloseTo(ends.at(-1) ?? Number.NaN, 3);
  });

  test("it refuses to build the video without a recording of every browser", async () => {
    const planDemoVideo = await loadPlanner();
    const withoutFirefox = (await testedBrowsers()).filter(
      (name) => name !== "Firefox",
    );

    expect(() => planDemoVideo(recordingsOf(withoutFirefox, 30))).toThrow(
      /Firefox/,
    );
  });

  test("each section opens with a Japanese caption naming its browser", async () => {
    const plan = (await loadPlanner())(
      recordingsOf(await testedBrowsers(), 30),
    );

    const captions = plan.sections.map((section) => ({
      project: section.project,
      startsTheSection:
        Math.abs(section.caption.startSeconds - section.startSeconds) < 0.001,
      isShownLongEnoughToRead: section.caption.durationSeconds >= 2,
      isJapanese: JAPANESE.test(section.caption.text),
      namesTheBrowser: section.caption.text.includes(
        BROWSER_NAME[section.project] ?? section.project,
      ),
    }));

    expect(captions).toEqual(
      plan.sections.map((section) => ({
        project: section.project,
        startsTheSection: true,
        isShownLongEnoughToRead: true,
        isJapanese: true,
        namesTheBrowser: true,
      })),
    );
  });

  test.each([20, 32, 40])(
    "with recordings of %d seconds each, the video is 2 to 4 minutes long",
    async (seconds) => {
      const plan = (await loadPlanner())(
        recordingsOf(await testedBrowsers(), seconds),
      );

      expect(plan.totalSeconds).toBeGreaterThanOrEqual(120);
      expect(plan.totalSeconds).toBeLessThanOrEqual(240);
    },
  );
});
