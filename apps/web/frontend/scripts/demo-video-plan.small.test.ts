import { describe, expect, it } from "vitest";
import {
  CAPTION_SECONDS,
  companionFiles,
  demoLanguage,
  demoVideoFile,
  ffmpegArguments,
  filterOptionValue,
  isRecordingDirectoryOf,
  planDemoVideo,
  recordingDirectoriesFor,
  THUMBNAIL_TEXT,
  thumbnailArguments,
  thumbnailSeconds,
  thumbnailText,
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

describe("companionFiles", () => {
  it("writes the plan, thumbnail, and upload record beside the video", () => {
    expect(companionFiles("C:/media/v1.0.0/demo.mp4")).toEqual({
      plan: "C:/media/v1.0.0/demo.plan.json",
      thumbnail: "C:/media/v1.0.0/demo.thumbnail.jpg",
      upload: "C:/media/v1.0.0/demo.youtube.json",
    });
  });

  it("keeps a dot in a directory name", () => {
    expect(companionFiles("C:/media/v1.0.0/demo").plan).toBe(
      "C:/media/v1.0.0/demo.plan.json",
    );
  });
});

describe("thumbnailSeconds", () => {
  it("takes the frame 17 seconds into the first recording, past its caption", () => {
    const plan = planDemoVideo(recordingsOf(32));

    expect(thumbnailSeconds(plan)).toBeCloseTo(CAPTION_SECONDS + 17, 3);
  });

  it("stays inside the first section when its recording is shorter", () => {
    const plan = planDemoVideo(recordingsOf(14));
    const [first] = plan.sections;

    expect(thumbnailSeconds(plan)).toBeLessThan(
      (first?.startSeconds ?? 0) + (first?.durationSeconds ?? 0),
    );
  });
});

describe("thumbnailArguments", () => {
  const args = thumbnailArguments({
    videoFile: "out/demo.mp4",
    atSeconds: 20,
    outputFile: "out/demo.thumbnail.jpg",
    fontFile: "C:/Windows/Fonts/meiryo.ttc",
  });
  const filter = args[args.indexOf("-vf") + 1] ?? "";

  it("takes one frame at the given time from the edited video", () => {
    expect(args.slice(args.indexOf("-ss"), args.indexOf("-ss") + 4)).toEqual([
      "-ss",
      "20",
      "-i",
      "out/demo.mp4",
    ]);
    expect(
      args.slice(args.indexOf("-frames:v"), args.indexOf("-frames:v") + 2),
    ).toEqual(["-frames:v", "1"]);
  });

  it("sizes it 1280x720 and draws the title with the given font", () => {
    expect(filter).toContain("scale=1280:720");
    expect(filter).toContain(`text=${THUMBNAIL_TEXT}:`);
    expect(filter).toContain("fontfile=C\\\\:/Windows/Fonts/meiryo.ttc:");
  });

  it("writes the JPEG last", () => {
    expect(args.at(-1)).toBe("out/demo.thumbnail.jpg");
  });

  it("draws the Japanese title when no language is given", () => {
    expect(THUMBNAIL_TEXT).toBe(thumbnailText("ja"));
  });

  it("draws the English title for the English video", () => {
    const english = thumbnailArguments({
      videoFile: "out/demo.en.mp4",
      atSeconds: 20,
      outputFile: "out/demo.en.thumbnail.jpg",
      fontFile: "C:/Windows/Fonts/meiryo.ttc",
      language: "en",
    });
    const englishFilter = english[english.indexOf("-vf") + 1] ?? "";

    expect(englishFilter).toContain(
      `text=${filterOptionValue(thumbnailText("en"))}:`,
    );
    expect(englishFilter).not.toContain(THUMBNAIL_TEXT);
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

describe("planDemoVideo in English", () => {
  const english = planDemoVideo(recordingsOf(32), "en");

  it("names each browser in English, in the same order as the Japanese video", () => {
    expect(english.sections.map((section) => section.caption.text)).toEqual([
      "Google Chrome on a computer",
      "Microsoft Edge on a computer",
      "Safari on a Mac",
      "Chrome on an Android phone",
      "Safari on an iPhone",
      "Firefox on a computer",
    ]);
  });

  it("numbers the sections the same way as the Japanese video", () => {
    expect(english.sections.map((section) => section.caption.subtitle)).toEqual(
      planDemoVideo(recordingsOf(32)).sections.map(
        (section) => section.caption.subtitle,
      ),
    );
  });
});

describe("demoLanguage", () => {
  it.each([
    [undefined, "ja"],
    ["ja", "ja"],
    ["en", "en"],
  ])("reads %s as %s", (argument, language) => {
    expect(demoLanguage(argument)).toBe(language);
  });

  it("names the languages it has when given another", () => {
    expect(() => demoLanguage("EN")).toThrow(/"EN".*ja, en/);
  });
});

describe("demoVideoFile", () => {
  it("keeps the Japanese video where it has always been written", () => {
    expect(demoVideoFile("/home/me/.zipnami-media/v1.0.0", "ja")).toBe(
      "/home/me/.zipnami-media/v1.0.0/zipnami-v1.0.0-demo.mp4",
    );
  });

  it("joins with the separator the directory already uses", () => {
    expect(demoVideoFile("C:\\Users\\me\\media", "ja")).toBe(
      "C:\\Users\\me\\media\\zipnami-v1.0.0-demo.mp4",
    );
  });

  it("marks the English video's name, so its plan, thumbnail, and upload record are its own", () => {
    const japanese = companionFiles(demoVideoFile("media", "ja"));
    const english = companionFiles(demoVideoFile("media", "en"));

    expect(demoVideoFile("media", "en")).toMatch(
      /zipnami-v1\.0\.0-demo\.en\.mp4$/,
    );
    expect(Object.values(english)).not.toContain(japanese.plan);
    expect(Object.values(english)).not.toContain(japanese.thumbnail);
    expect(Object.values(english)).not.toContain(japanese.upload);
  });

  it("writes the Japanese video to the file DEMO_VIDEO_OUTPUT names", () => {
    expect(demoVideoFile("media", "ja", "C:/out/demo.mp4")).toBe(
      "C:/out/demo.mp4",
    );
  });

  it("marks the English video's name in DEMO_VIDEO_OUTPUT too, so it never overwrites the Japanese video or reads its upload record", () => {
    expect(demoVideoFile("media", "en", "C:/out/demo.mp4")).toBe(
      "C:/out/demo.en.mp4",
    );
  });

  it("keeps a dot in the override's directory name", () => {
    expect(demoVideoFile("media", "en", "C:/v1.0.0/demo")).toBe(
      "C:/v1.0.0/demo.en.mp4",
    );
  });

  it("keeps the English plan, thumbnail, and upload record apart when DEMO_VIDEO_OUTPUT has no extension", () => {
    const override = "C:/v1.0.0/demo";
    const japanese = companionFiles(demoVideoFile("media", "ja", override));
    const english = companionFiles(demoVideoFile("media", "en", override));

    expect(Object.values(english)).not.toContain(japanese.upload);
  });
});
