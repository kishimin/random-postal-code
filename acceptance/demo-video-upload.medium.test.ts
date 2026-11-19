import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #132, criteria 5 and 6:
 *
 * 5. "The video is uploaded to YouTube as private through the YouTube Data
 *    API, with a Japanese title, a description that contains
 *    https://zipnami.pages.dev, chapters for the six browsers, and a
 *    thumbnail."
 * 6. "No OAuth client secret, refresh token, or access token appears in a
 *    commit, an Issue, a PR, or CI output."
 *
 * Each test name states the part of a criterion it holds.
 *
 * What is and is not exercised here
 * ---------------------------------
 * The upload needs the owner's OAuth credentials and sends a real video to
 * YouTube, so CI never runs it. This test holds what the upload sends and
 * what it may print instead:
 *
 * - the frontend has one script that runs the upload script;
 * - the video resource it sends is private, has a Japanese title, and a
 *   description with the site URL and one chapter per browser, in the order
 *   and at the times of the edited video, in the form YouTube reads as
 *   chapters (first at 0:00, ascending, at least 10 seconds apart);
 * - the upload sets a thumbnail;
 * - any text the upload prints passes through redaction that removes the
 *   client secret, the refresh token, and the access token.
 *
 * The upload itself, and the owner's reply with the public URL, are shown on
 * the Issue.
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

type Recording = { project: string; durationSeconds: number };
type Plan = {
  sections: {
    project: string;
    startSeconds: number;
    caption: { text: string };
  }[];
  totalSeconds: number;
};
type VideoResource = {
  snippet: { title: string; description: string };
  status: { privacyStatus: string };
};
type UploadStep = { name: string };
type UploadModule = {
  videoResource: (plan: Plan) => VideoResource;
  uploadSteps: () => UploadStep[];
  redactSecrets: (text: string, secrets: string[]) => string;
};

const SIX_BROWSERS = [
  "Google Chrome",
  "Microsoft Edge",
  "Safari",
  "Android (Chrome)",
  "iPhone (Safari)",
  "Firefox",
];

const loadPlan = async (secondsEach: number): Promise<Plan> => {
  const { planDemoVideo } = (await import(
    path.join(scriptsDirectory, "demo-video-plan.ts")
  )) as { planDemoVideo: (recordings: Recording[]) => Plan };

  return planDemoVideo(
    SIX_BROWSERS.map((project) => ({ project, durationSeconds: secondsEach })),
  );
};

const loadUpload = async (): Promise<UploadModule> =>
  (await import(
    path.join(scriptsDirectory, "demo-video-upload.ts")
  )) as UploadModule;

const UPLOAD_SCRIPT = /^bun (?:run )?scripts\/upload-demo-video\.ts(?: |$)/;

// Hiragana, katakana, or kanji: a title with none of them is not Japanese.
const JAPANESE = /[぀-ヿ一-鿿]/u;

// A YouTube chapter line: a timestamp at the start of the line, then a title.
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

describe("Issue #132: the demo video is uploaded as private with chapters", () => {
  test("the frontend has one script that runs the upload script", () => {
    const manifest = JSON.parse(
      readFileSync(
        path.join(repositoryRoot, "apps", "web", "frontend", "package.json"),
        "utf8",
      ),
    ) as { scripts: Record<string, string> };

    const upload = Object.entries(manifest.scripts).filter(([, command]) =>
      UPLOAD_SCRIPT.test(command),
    );

    expect(upload.map(([name]) => name)).toEqual(["upload:demo"]);
  });

  test("the video is uploaded as private", async () => {
    const { videoResource } = await loadUpload();

    expect(videoResource(await loadPlan(32)).status.privacyStatus).toBe(
      "private",
    );
  });

  test("the title is Japanese", async () => {
    const { videoResource } = await loadUpload();

    expect(videoResource(await loadPlan(32)).snippet.title).toMatch(JAPANESE);
  });

  test("the description links https://zipnami.pages.dev", async () => {
    const { videoResource } = await loadUpload();

    expect(videoResource(await loadPlan(32)).snippet.description).toContain(
      "https://zipnami.pages.dev",
    );
  });

  test.each([20, 32, 40])(
    "with %d-second recordings, the description has one chapter per browser at the start of its section",
    async (seconds) => {
      const { videoResource } = await loadUpload();
      const plan = await loadPlan(seconds);

      const chapters = chaptersOf(videoResource(plan).snippet.description);

      expect(chapters).toEqual(
        plan.sections.map((section) => ({
          seconds: Math.floor(section.startSeconds),
          title: section.caption.text,
        })),
      );
    },
  );

  test("the chapters are ones YouTube shows: the first at 0:00, then ascending, each at least 10 seconds long", async () => {
    const { videoResource } = await loadUpload();
    const plan = await loadPlan(20);

    const starts = chaptersOf(videoResource(plan).snippet.description).map(
      (chapter) => chapter.seconds,
    );
    const lengths = [...starts.slice(1), plan.totalSeconds].map(
      (end, index) => end - (starts[index] ?? 0),
    );

    expect(starts[0]).toBe(0);
    expect(lengths.every((length) => length >= 10)).toBe(true);
  });

  test("the upload sets a thumbnail after uploading the video", async () => {
    const { uploadSteps } = await loadUpload();

    const names = uploadSteps().map((step) => step.name);

    expect(names).toContain("thumbnail");
    expect(names.indexOf("thumbnail")).toBeGreaterThan(names.indexOf("video"));
  });

  test("text the upload prints has the client secret, refresh token, and access token removed", async () => {
    const { redactSecrets } = await loadUpload();
    const secrets = [
      "GOCSPX-client-secret-value",
      "1//refresh-token-value",
      "ya29.access-token-value",
    ];

    const printed = redactSecrets(
      `failed: client_secret=${secrets[0] ?? ""} refresh_token=${secrets[1] ?? ""} Authorization: Bearer ${secrets[2] ?? ""}`,
      secrets,
    );

    expect(secrets.filter((secret) => printed.includes(secret))).toEqual([]);
    expect(printed).toContain("failed:");
  });
});
