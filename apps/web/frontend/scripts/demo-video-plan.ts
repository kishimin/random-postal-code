/*
 * Plans the edited v1.0.0 demo video (Issue #132, step 4): which recording
 * plays when, at what pace, and the caption that opens each browser's section.
 *
 * Kept free of ffmpeg and the file system, so the plan can be tested on CI
 * without the recordings (kept outside git) or ffmpeg. edit-demo-video.ts
 * measures the recordings, asks for a plan, and hands it to ffmpeg.
 */

export type Recording = { project: string; durationSeconds: number };

export type Caption = {
  text: string;
  subtitle: string;
  startSeconds: number;
  durationSeconds: number;
};

export type Section = {
  project: string;
  startSeconds: number;
  durationSeconds: number;
  /** How many times longer the recording plays than it was recorded. */
  stretch: number;
  caption: Caption;
};

export type DemoVideoPlan = { sections: Section[]; totalSeconds: number };

/*
 * The caption per Playwright project. It is also the list of browsers the
 * video must show: a project with no caption here, or a caption with no
 * recording, stops the build rather than leaving a section unnamed or out.
 */
const CAPTIONS: ReadonlyMap<string, string> = new Map([
  ["Google Chrome", "パソコンの Google Chrome"],
  ["Microsoft Edge", "パソコンの Microsoft Edge"],
  ["Safari", "パソコンの Safari"],
  ["Android (Chrome)", "Android スマートフォンの Chrome"],
  ["iPhone (Safari)", "iPhone の Safari"],
  ["Firefox", "パソコンの Firefox"],
]);

/** How long the caption card before each recording stays on screen. */
export const CAPTION_SECONDS = 3;

export const MIN_TOTAL_SECONDS = 120;
export const MAX_TOTAL_SECONDS = 240;
const TARGET_TOTAL_SECONDS = 180;

// Slower than this, the cursor and scrolling look like slow motion rather
// than someone using the site.
const MAX_STRETCH = 1.5;
// Faster than this, the pauses the journey makes on each screen get too short
// to follow, which is what Issue #132 asks the video not to do.
const MIN_STRETCH = 0.9;
// Room under four minutes for each section rounding up to whole frames.
const FRAME_ROUNDING_MARGIN_SECONDS = 2;

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

const checkRecordings = (recordings: Recording[]) => {
  const projects = recordings.map((recording) => recording.project);

  const unknown = projects.filter((project) => !CAPTIONS.has(project));
  if (unknown.length > 0) {
    throw new Error(`No caption for: ${unknown.join(", ")}`);
  }

  const duplicated = projects.filter(
    (project, index) => projects.indexOf(project) !== index,
  );
  if (duplicated.length > 0) {
    throw new Error(`Recorded more than once: ${duplicated.join(", ")}`);
  }

  const missing = [...CAPTIONS.keys()].filter(
    (project) => !projects.includes(project),
  );
  if (missing.length > 0) {
    throw new Error(`No recording of: ${missing.join(", ")}`);
  }

  const empty = recordings
    .filter(
      (recording) =>
        !Number.isFinite(recording.durationSeconds) ||
        recording.durationSeconds <= 0,
    )
    .map((recording) => recording.project);
  if (empty.length > 0) {
    throw new Error(`Recording has no length: ${empty.join(", ")}`);
  }
};

/*
 * One pace for the whole video, not one per browser: a viewer comparing
 * browsers would otherwise read a slower section as a slower site.
 */
const paceFor = (recordedSeconds: number, captionSeconds: number) => {
  const towardTarget = (TARGET_TOTAL_SECONDS - captionSeconds) / recordedSeconds;
  const slowed = Math.min(Math.max(towardTarget, 1), MAX_STRETCH);
  const longest =
    MAX_TOTAL_SECONDS - FRAME_ROUNDING_MARGIN_SECONDS - captionSeconds;

  return recordedSeconds * slowed > longest
    ? longest / recordedSeconds
    : slowed;
};

/**
 * Lays out one section per recording, in the order given.
 * @param recordings One per browser, in the order the video shows them.
 * @returns The sections and the length of the whole video.
 */
export const planDemoVideo = (recordings: Recording[]): DemoVideoPlan => {
  checkRecordings(recordings);

  const recordedSeconds = sum(
    recordings.map((recording) => recording.durationSeconds),
  );
  const captionSeconds = recordings.length * CAPTION_SECONDS;
  const stretch = paceFor(recordedSeconds, captionSeconds);
  const totalSeconds = captionSeconds + recordedSeconds * stretch;

  if (
    stretch < MIN_STRETCH ||
    totalSeconds < MIN_TOTAL_SECONDS ||
    totalSeconds > MAX_TOTAL_SECONDS
  ) {
    throw new Error(
      `The recordings add up to ${recordedSeconds.toFixed(1)} s, which cannot ` +
        `make a 2 to 4 minute video at a pace a viewer can follow; ` +
        `re-record them (bun run record:demo).`,
    );
  }

  let startSeconds = 0;
  const sections = recordings.map((recording, index): Section => {
    const durationSeconds =
      CAPTION_SECONDS + recording.durationSeconds * stretch;
    const section = {
      project: recording.project,
      startSeconds,
      durationSeconds,
      stretch,
      caption: {
        text: CAPTIONS.get(recording.project) ?? recording.project,
        subtitle: `${String(index + 1)} / ${String(recordings.length)}`,
        startSeconds,
        durationSeconds: CAPTION_SECONDS,
      },
    };
    startSeconds += durationSeconds;

    return section;
  });

  return { sections, totalSeconds };
};

/**
 * Whether a directory Playwright wrote is the recording of a project.
 * Playwright ends each test's output directory with the project name, every
 * run of other characters turned into one "-".
 * @param directoryName The directory's own name, not its path.
 * @param project The Playwright project name.
 * @returns True when the directory belongs to that project.
 */
export const isRecordingDirectoryOf = (
  directoryName: string,
  project: string,
): boolean =>
  directoryName.endsWith(`-${project.replace(/[^A-Za-z0-9]+/g, "-")}`);

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const BACKGROUND = "0x1c1917";

// A value inside single quotes in a filter graph: only the quote itself, the
// backslash, the option separator, and drawtext's own % expansion need it.
const quoted = (value: string) =>
  `'${value.replace(/[\\':%]/g, (character) => `\\${character}`)}'`;

type EncodeRequest = {
  plan: DemoVideoPlan;
  /** One per section, in the same order. */
  videoFiles: string[];
  outputFile: string;
  /** A font with Japanese glyphs; the captions are tofu without one. */
  fontFile: string;
};

/**
 * The ffmpeg arguments that encode a plan into one video.
 * @param request The plan, its recordings, the output, and the caption font.
 * @returns Arguments for ffmpeg, without the program name.
 */
export const ffmpegArguments = ({
  plan,
  videoFiles,
  outputFile,
  fontFile,
}: EncodeRequest): string[] => {
  if (videoFiles.length !== plan.sections.length) {
    throw new Error(
      `${String(plan.sections.length)} sections need ${String(plan.sections.length)} recordings, got ${String(videoFiles.length)}`,
    );
  }

  const font = `fontfile=${quoted(fontFile)}`;
  const chains = plan.sections.flatMap((section, index) => [
    `color=c=${BACKGROUND}:s=${String(WIDTH)}x${String(HEIGHT)}:r=${String(FPS)}:d=${String(section.caption.durationSeconds)},` +
      `drawtext=${font}:text=${quoted(section.caption.text)}:fontcolor=white:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2-60,` +
      `drawtext=${font}:text=${quoted(section.caption.subtitle)}:fontcolor=0xd6d3d1:fontsize=48:x=(w-text_w)/2:y=h/2+80,` +
      `setsar=1,format=yuv420p[caption${String(index)}]`,
    `[${String(index)}:v]setpts=${String(section.stretch)}*(PTS-STARTPTS),fps=${String(FPS)},` +
      `scale=${String(WIDTH)}:${String(HEIGHT)}:force_original_aspect_ratio=decrease,` +
      `pad=${String(WIDTH)}:${String(HEIGHT)}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND},` +
      `setsar=1,format=yuv420p[recording${String(index)}]`,
  ]);
  const joined =
    plan.sections
      .map((_, index) => `[caption${String(index)}][recording${String(index)}]`)
      .join("") +
    `concat=n=${String(plan.sections.length * 2)}:v=1:a=0[video]`;

  return [
    "-y",
    ...videoFiles.flatMap((file) => ["-i", file]),
    "-filter_complex",
    [...chains, joined].join(";"),
    "-map",
    "[video]",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputFile,
  ];
};
