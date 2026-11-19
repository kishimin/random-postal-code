import { describe, expect, it } from "vitest";
import {
  CAPTION_SECONDS,
  ffmpegArguments,
  filterOptionValue,
  isRecordingDirectoryOf,
  planDemoVideo,
  recordingDirectoriesFor,
} from "./demo-video-plan.ts";

const SIX_BROWSERS = [
  "Google Chrome",
  "Microsoft Edge",
  "Safari",
  "Android (Chrome)",
  "iPhone (Safari)",
  "Firefox",
];

const recordingsOf = (durationSeconds: number) =>
  SIX_BROWSERS.map((project) => ({ project, durationSeconds }));

describe("planDemoVideo", () => {
  it("slows short recordings so the video comes close to three minutes", () => {
    const plan = planDemoVideo(recordingsOf(20));

    expect(plan.sections[0]?.stretch).toBeGreaterThan(1);
    expect(plan.totalSeconds).toBeCloseTo(180, 3);
  });

  it("never slows a recording to more than one and a half times its length", () => {
    const plan = planDemoVideo(recordingsOf(14));

    expect(plan.sections.map((section) => section.stretch)).toEqual(
      SIX_BROWSERS.map(() => 1.5),
    );
  });

  it("plays recordings at their own speed when they already fill two to four minutes", () => {
    const plan = planDemoVideo(recordingsOf(32));

    expect(plan.sections.map((section) => section.stretch)).toEqual(
      SIX_BROWSERS.map(() => 1),
    );
    expect(plan.totalSeconds).toBeCloseTo(6 * (32 + CAPTION_SECONDS), 3);
  });

  it("speeds long recordings up just enough to stay inside four minutes", () => {
    const plan = planDemoVideo(recordingsOf(40));

    expect(plan.sections[0]?.stretch).toBeLessThan(1);
    expect(plan.totalSeconds).toBeLessThan(240);
    expect(plan.totalSeconds).toBeGreaterThan(235);
  });

  it("gives every section the same pace", () => {
    const plan = planDemoVideo(
      SIX_BROWSERS.map((project, index) => ({
        project,
        durationSeconds: 20 + index,
      })),
    );

    expect(new Set(plan.sections.map((section) => section.stretch)).size).toBe(
      1,
    );
  });

  it("refuses recordings too long to fit without hurrying the viewer", () => {
    expect(() => planDemoVideo(recordingsOf(60))).toThrow(/re-record/);
  });

  it("refuses recordings too short to fill two minutes even when slowed", () => {
    expect(() => planDemoVideo(recordingsOf(5))).toThrow(/re-record/);
  });

  it("names a browser it has no caption for", () => {
    expect(() =>
      planDemoVideo([
        ...recordingsOf(30),
        { project: "Opera", durationSeconds: 30 },
      ]),
    ).toThrow(/Opera/);
  });

  it("names a browser recorded twice", () => {
    expect(() =>
      planDemoVideo([
        ...recordingsOf(30),
        { project: "Safari", durationSeconds: 30 },
      ]),
    ).toThrow(/Safari/);
  });

  it("names a recording with no length", () => {
    expect(() =>
      planDemoVideo(
        recordingsOf(30).map((recording) =>
          recording.project === "Firefox"
            ? { ...recording, durationSeconds: 0 }
            : recording,
        ),
      ),
    ).toThrow(/Firefox/);
  });

  it("numbers each caption with its place among the six", () => {
    const plan = planDemoVideo(recordingsOf(30));

    expect(plan.sections.map((section) => section.caption.subtitle)).toEqual([
      "1 / 6",
      "2 / 6",
      "3 / 6",
      "4 / 6",
      "5 / 6",
      "6 / 6",
    ]);
  });
});

describe("isRecordingDirectoryOf", () => {
  const directoryOf = (suffix: string) =>
    `demo-journey.recording.ts--89711-guide-and-return-to-the-top-${suffix}`;

  it.each([
    ["Google Chrome", "Google-Chrome"],
    ["Android (Chrome)", "Android-Chrome-"],
    ["iPhone (Safari)", "iPhone-Safari-"],
  ])("finds the directory Playwright names after %s", (project, suffix) => {
    expect(isRecordingDirectoryOf(directoryOf(suffix), project)).toBe(true);
  });

  it("does not take the iPhone (Safari) directory for Safari", () => {
    expect(
      isRecordingDirectoryOf(directoryOf("iPhone-Safari-"), "Safari"),
    ).toBe(false);
  });
});

describe("recordingDirectoriesFor", () => {
  const directoryOf = (suffix: string) => `demo-journey-89711-${suffix}`;

  it("lists the directories in the order of the projects, not of the file system", () => {
    expect(
      recordingDirectoriesFor(
        ["Google Chrome", "Android (Chrome)", "Safari"],
        [
          directoryOf("Android-Chrome-"),
          directoryOf("Google-Chrome"),
          directoryOf("Safari"),
        ],
      ),
    ).toEqual([
      directoryOf("Google-Chrome"),
      directoryOf("Android-Chrome-"),
      directoryOf("Safari"),
    ]);
  });

  it("names a project with no recording", () => {
    expect(() =>
      recordingDirectoriesFor(["Firefox"], [directoryOf("Safari")]),
    ).toThrow(/Firefox.*found 0/);
  });

  it("names a project recorded in two directories", () => {
    expect(() =>
      recordingDirectoriesFor(
        ["Safari"],
        ["first-run-Safari", "second-run-Safari"],
      ),
    ).toThrow(/Safari.*found 2/);
  });
});

describe("filterOptionValue", () => {
  it.each([
    ["the option separator", "C:/Fonts/a.ttc", "C\\\\:/Fonts/a.ttc"],
    ["a quote", "O'Neil", "O\\\\\\'Neil"],
    [
      "the characters that end a filter or name a pad",
      "a,b[c];d",
      "a\\,b\\[c\\]\\;d",
    ],
    ["a backslash", "a\\b", "a\\\\\\\\b"],
  ])("escapes %s for both of ffmpeg's passes", (_, value, escaped) => {
    expect(filterOptionValue(value)).toBe(escaped);
  });

  it("leaves Japanese text and spaces as they are", () => {
    expect(filterOptionValue("パソコンの Google Chrome")).toBe(
      "パソコンの Google Chrome",
    );
  });
});

describe("ffmpegArguments", () => {
  const plan = planDemoVideo(recordingsOf(20));
  const videoFiles = SIX_BROWSERS.map((project) => `in/${project}.webm`);
  const args = ffmpegArguments({
    plan,
    videoFiles,
    outputFile: "out/demo.mp4",
    fontFile: "C:/Windows/Fonts/meiryo.ttc",
  });
  const filter = args[args.indexOf("-filter_complex") + 1] ?? "";

  it("reads the recordings in the order of the sections", () => {
    const inputs = args.flatMap((arg, index) =>
      arg === "-i" ? [args[index + 1]] : [],
    );

    expect(inputs).toEqual(videoFiles);
  });

  it("draws every caption with the given font", () => {
    for (const section of plan.sections) {
      expect(filter).toContain(`text=${section.caption.text}:`);
    }
    expect(filter).toContain("fontfile=C\\\\:/Windows/Fonts/meiryo.ttc:");
  });

  it("joins a caption card and a recording per section, with no sound", () => {
    expect(filter).toContain("concat=n=12:v=1:a=0");
    expect(args).toContain("-an");
  });

  it("plays each recording at the planned pace", () => {
    plan.sections.forEach((section, index) => {
      expect(filter).toContain(
        `[${String(index)}:v]setpts=${String(section.stretch)}*(PTS-STARTPTS),`,
      );
    });
  });

  it("writes the video last, overwriting an earlier build", () => {
    expect(args[0]).toBe("-y");
    expect(args.at(-1)).toBe("out/demo.mp4");
  });

  it("refuses a recording list that does not match the sections", () => {
    expect(() =>
      ffmpegArguments({
        plan,
        videoFiles: videoFiles.slice(1),
        outputFile: "out/demo.mp4",
        fontFile: "font.ttc",
      }),
    ).toThrow(/6/);
  });
});
