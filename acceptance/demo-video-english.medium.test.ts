import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #165:
 *
 * 1. "One command builds the English video from the existing recordings, and
 *    the Japanese video is unchanged."
 * 2. "Every caption in the English video is English."
 * 3. "The English video is uploaded to YouTube as private, with an English
 *    title, an English description that contains https://zipnami.pages.dev,
 *    English chapters for the six browsers, and an English thumbnail."
 * 4. "Discord receives the Studio link and an English X post with #Zipnami
 *    and the video link, within 280 as X counts it."
 *
 * Each test name states the part of a criterion it holds.
 *
 * What is and is not exercised here
 * ---------------------------------
 * The recordings live outside git and the upload needs the owner's OAuth
 * credentials, so CI runs neither ffmpeg nor YouTube. This test holds what
 * decides the English video and what is sent with it:
 *
 * - edit:demo and upload:demo take the language as their one argument
 *   (demo-video-editing and demo-video-upload already hold that each is the
 *   only script running its file); the English video is written to its own
 *   file, and the Japanese one keeps its file, plan, and upload unchanged;
 * - every caption the English plan draws is English and names its browser;
 * - the English upload is private, with an English title, an English
 *   description that links the site, says the site is in Japanese, and has
 *   one English chapter per browser, and an English thumbnail;
 * - the English X post has #Zipnami and the video link, and weighs at most
 *   280 by the counting announce-release.mjs already checks release posts
 *   with.
 *
 * Running the commands, the upload, and the Discord message are shown on the
 * Issue.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const scriptsDirectory = path.join(
  repositoryRoot,
  "apps",
  "web",
  "frontend",
  "scripts",
);

type Language = "ja" | "en";
type Recording = { project: string; durationSeconds: number };
type Plan = {
  sections: {
    project: string;
    startSeconds: number;
    caption: { text: string; subtitle: string };
  }[];
  totalSeconds: number;
};
type PlanModule = {
  planDemoVideo: (recordings: Recording[], language?: Language) => Plan;
  demoLanguage: (argument: string | undefined) => Language;
  demoVideoFile: (mediaDirectory: string, language: Language) => string;
  thumbnailText: (language: Language) => string;
};
type VideoResource = {
  snippet: {
    title: string;
    description: string;
    defaultLanguage: string;
  };
  status: { privacyStatus: string };
};
type UploadModule = {
  videoResource: (plan: Plan, language?: Language) => VideoResource;
  xPost: (videoId: string, language: Language) => string;
};

const SIX_BROWSERS = [
  "Google Chrome",
  "Microsoft Edge",
  "Safari",
  "Android (Chrome)",
  "iPhone (Safari)",
  "Firefox",
];

const BROWSER_NAME: Record<string, string> = {
  "Google Chrome": "Chrome",
  "Microsoft Edge": "Edge",
  Safari: "Safari",
  "Android (Chrome)": "Android",
  "iPhone (Safari)": "iPhone",
  Firefox: "Firefox",
};

const recordings = (secondsEach: number): Recording[] =>
  SIX_BROWSERS.map((project) => ({ project, durationSeconds: secondsEach }));

const loadPlanModule = async (): Promise<PlanModule> =>
  (await import(
    path.join(scriptsDirectory, "demo-video-plan.ts")
  )) as PlanModule;

const loadUploadModule = async (): Promise<UploadModule> =>
  (await import(
    path.join(scriptsDirectory, "demo-video-upload.ts")
  )) as UploadModule;

const loadWeightedLength = async (): Promise<(text: string) => number> => {
  const module = (await import(
    path.join(repositoryRoot, ".github", "scripts", "announce-release.mjs")
  )) as { weightedLength: (text: string) => number };

  return module.weightedLength;
};

// English text here is printable ASCII: no kana, kanji, or full-width
// punctuation that a Japanese caption would bring with it.
const ENGLISH = /^[\x20-\x7e]+$/;
const ENGLISH_LINES = /^[\x20-\x7e\n]+$/;

const CHAPTER = /^(?:(\d+):)?(\d{1,2}):(\d{2}) (.+)$/u;

const chaptersOf = (description: string) =>
  description.split("\n").flatMap((line) => {
    const match = CHAPTER.exec(line.trim());
    if (match === null) {
      return [];
    }
    const [, hours = "0", minutes = "0", seconds = "0", title = ""] = match;

    return [
      {
        seconds: Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds),
        title,
      },
    ];
  });

describe("Issue #165: one command builds the English video, and the Japanese one is unchanged", () => {
  test("the command reads its language from its argument: none or ja is Japanese, en is English", async () => {
    const { demoLanguage } = await loadPlanModule();

    expect([undefined, "ja", "en"].map(demoLanguage)).toEqual([
      "ja",
      "ja",
      "en",
    ]);
  });

  test("a language it does not have stops the command", async () => {
    const { demoLanguage } = await loadPlanModule();

    // Without this, calling a missing export throws a TypeError that quotes
    // the call, "fr" included, and the next line would pass for no reason.
    expect(typeof demoLanguage).toBe("function");
    expect(() => demoLanguage("fr")).toThrow(/fr/);
  });

  test("the Japanese video keeps its file, and the English video is written to a file of its own", async () => {
    const { demoVideoFile } = await loadPlanModule();
    const mediaDirectory = path.join("home", ".zipnami-media", "v1.0.0");

    expect(demoVideoFile(mediaDirectory, "ja")).toBe(
      path.join(mediaDirectory, "zipnami-v1.0.0-demo.mp4"),
    );
    expect(demoVideoFile(mediaDirectory, "en")).not.toBe(
      demoVideoFile(mediaDirectory, "ja"),
    );
    expect(path.dirname(demoVideoFile(mediaDirectory, "en"))).toBe(
      mediaDirectory,
    );
  });

  test("the Japanese plan is the same as the plan without a language", async () => {
    const { planDemoVideo } = await loadPlanModule();

    expect(planDemoVideo(recordings(32), "ja")).toEqual(
      planDemoVideo(recordings(32)),
    );
  });

  test("the English video has the same sections and timing as the Japanese one", async () => {
    const { planDemoVideo } = await loadPlanModule();
    const timing = (plan: Plan) =>
      plan.sections.map((section) => [section.project, section.startSeconds]);

    const english = planDemoVideo(recordings(32), "en");
    const japanese = planDemoVideo(recordings(32), "ja");

    expect(timing(english)).toEqual(timing(japanese));
    expect(english.totalSeconds).toBeCloseTo(japanese.totalSeconds, 6);
  });
});

describe("Issue #165: every caption in the English video is English", () => {
  test("each section's caption and subtitle are English and the caption names its browser", async () => {
    const { planDemoVideo } = await loadPlanModule();
    const plan = planDemoVideo(recordings(32), "en");

    const captions = plan.sections.map((section) => ({
      project: section.project,
      textIsEnglish: ENGLISH.test(section.caption.text),
      subtitleIsEnglish: ENGLISH.test(section.caption.subtitle),
      namesTheBrowser: section.caption.text.includes(
        BROWSER_NAME[section.project] ?? section.project,
      ),
    }));

    expect(captions).toEqual(
      SIX_BROWSERS.map((project) => ({
        project,
        textIsEnglish: true,
        subtitleIsEnglish: true,
        namesTheBrowser: true,
      })),
    );
  });
});

describe("Issue #165: the English video is uploaded as private with English text", () => {
  test("the English upload is private, in English", async () => {
    const { planDemoVideo } = await loadPlanModule();
    const { videoResource } = await loadUploadModule();

    const resource = videoResource(planDemoVideo(recordings(32), "en"), "en");

    expect(resource.status.privacyStatus).toBe("private");
    expect(resource.snippet.defaultLanguage).toBe("en");
  });

  test("the English title is English and names Zipnami", async () => {
    const { planDemoVideo } = await loadPlanModule();
    const { videoResource } = await loadUploadModule();

    const { title } = videoResource(
      planDemoVideo(recordings(32), "en"),
      "en",
    ).snippet;

    expect(title).toMatch(ENGLISH);
    expect(title).toContain("Zipnami");
  });

  test("the English description is English, links https://zipnami.pages.dev, and says the site is in Japanese", async () => {
    const { planDemoVideo } = await loadPlanModule();
    const { videoResource } = await loadUploadModule();

    const { description } = videoResource(
      planDemoVideo(recordings(32), "en"),
      "en",
    ).snippet;

    expect(description).toMatch(ENGLISH_LINES);
    expect(description).toContain("https://zipnami.pages.dev");
    expect(description).toMatch(/in Japanese/);
  });

  test.each([20, 32, 40])(
    "with %d-second recordings, the English description has one English chapter per browser at the start of its section",
    async (seconds) => {
      const { planDemoVideo } = await loadPlanModule();
      const { videoResource } = await loadUploadModule();
      const plan = planDemoVideo(recordings(seconds), "en");

      const chapters = chaptersOf(
        videoResource(plan, "en").snippet.description,
      );

      expect(chapters).toEqual(
        plan.sections.map((section) => ({
          seconds: Math.floor(section.startSeconds),
          title: section.caption.text,
        })),
      );
      expect(chapters.every((chapter) => ENGLISH.test(chapter.title))).toBe(
        true,
      );
    },
  );

  test("the English thumbnail's words are English and name Zipnami", async () => {
    const { thumbnailText } = await loadPlanModule();

    expect(thumbnailText("en")).toMatch(ENGLISH);
    expect(thumbnailText("en")).toContain("Zipnami");
  });

  test("the Japanese upload is the same as the upload without a language", async () => {
    const { planDemoVideo } = await loadPlanModule();
    const { videoResource } = await loadUploadModule();
    const plan = planDemoVideo(recordings(32));

    expect(videoResource(plan, "ja")).toEqual(videoResource(plan));
  });
});

describe("Issue #165: the English X post", () => {
  test("is English, has #Zipnami and the video link, and weighs at most 280 as X counts it", async () => {
    const { xPost } = await loadUploadModule();
    const weightedLength = await loadWeightedLength();

    const post = xPost("fu29xlvOFZ8", "en");

    expect(post).toMatch(ENGLISH_LINES);
    expect(post).toContain("#Zipnami");
    expect(post).toContain("https://youtu.be/fu29xlvOFZ8");
    expect(weightedLength(post)).toBeLessThanOrEqual(280);
  });
});
