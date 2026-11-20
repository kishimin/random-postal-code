/*
 * Plans the edited v1.0.0 demo video (Issue #132, step 4): which recording
 * plays when, at what pace, and the caption that opens each browser's section.
 * The same recordings make a Japanese and an English video (Issue #165).
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

const LANGUAGE = { japanese: "ja", english: "en" } as const;

/** The languages the demo video is made in. */
export type Language = (typeof LANGUAGE)[keyof typeof LANGUAGE];

const LANGUAGES: readonly Language[] = Object.values(LANGUAGE);

/**
 * The language edit:demo and upload:demo were asked for, from their one
 * argument. Japanese when none is given, so the commands the Japanese video
 * was made with keep making it.
 * @param {string | undefined} argument - The command's first argument.
 * @returns {Language} The language to make or upload the video in.
 */
export const demoLanguage = (argument: string | undefined): Language => {
  if (argument === undefined) {
    return "ja";
  }
  const language = LANGUAGES.find((candidate) => candidate === argument);
  if (language === undefined) {
    throw new Error(
      `No demo video in "${argument}"; the languages are ${LANGUAGES.join(", ")}.`,
    );
  }

  return language;
};

/**
 * Where edit:demo writes the video in a language, and upload:demo reads it.
 * The Japanese file keeps the name it had before there was an English one, so
 * its plan, thumbnail, and upload record (which companionFiles derives from
 * it) still describe the video already on YouTube.
 *
 * Joined by hand rather than with node:path: the unit tests run in a browser.
 * @param {string} mediaDirectory - The directory the recordings are kept in.
 * @param {Language} language - The video's language.
 * @returns {string} The video's path.
 */
export const demoVideoFile = (
  mediaDirectory: string,
  language: Language,
): string => {
  const separator =
    mediaDirectory.lastIndexOf("\\") > mediaDirectory.lastIndexOf("/")
      ? "\\"
      : "/";
  const name =
    language === "ja"
      ? "zipnami-v1.0.0-demo.mp4"
      : `zipnami-v1.0.0-demo.${language}.mp4`;

  return `${mediaDirectory}${separator}${name}`;
};

/*
 * The caption per Playwright project, per language. Each is also the list of
 * browsers the video must show: a project with no caption here, or a caption
 * with no recording, stops the build rather than leaving a section unnamed or
 * out.
 */
const CAPTIONS: Record<Language, ReadonlyMap<string, string>> = {
  ja: new Map([
    ["Google Chrome", "パソコンの Google Chrome"],
    ["Microsoft Edge", "パソコンの Microsoft Edge"],
    ["Safari", "パソコンの Safari"],
    ["Android (Chrome)", "Android スマートフォンの Chrome"],
    ["iPhone (Safari)", "iPhone の Safari"],
    ["Firefox", "パソコンの Firefox"],
  ]),
  en: new Map([
    ["Google Chrome", "Google Chrome on a computer"],
    ["Microsoft Edge", "Microsoft Edge on a computer"],
    // The Playwright project runs WebKit as desktop Safari, which only a Mac
    // has; "on a computer" would suggest Windows to an English viewer.
    ["Safari", "Safari on a Mac"],
    ["Android (Chrome)", "Chrome on an Android phone"],
    ["iPhone (Safari)", "Safari on an iPhone"],
    ["Firefox", "Firefox on a computer"],
  ]),
};

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

const checkRecordings = (
  recordings: Recording[],
  captions: ReadonlyMap<string, string>,
) => {
  const projects = recordings.map((recording) => recording.project);

  const unknown = projects.filter((project) => !captions.has(project));
  if (unknown.length > 0) {
    throw new Error(`No caption for: ${unknown.join(", ")}`);
  }

  const duplicated = projects.filter(
    (project, index) => projects.indexOf(project) !== index,
  );
  if (duplicated.length > 0) {
    throw new Error(`Recorded more than once: ${duplicated.join(", ")}`);
  }

  const missing = [...captions.keys()].filter(
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
  const towardTarget =
    (TARGET_TOTAL_SECONDS - captionSeconds) / recordedSeconds;
  const slowed = Math.min(Math.max(towardTarget, 1), MAX_STRETCH);
  const longest =
    MAX_TOTAL_SECONDS - FRAME_ROUNDING_MARGIN_SECONDS - captionSeconds;

  return recordedSeconds * slowed > longest
    ? longest / recordedSeconds
    : slowed;
};

/**
 * Lays out one section per recording, in the order given. Only the captions
 * depend on the language, so both videos cut the recordings the same way.
 * @param {Recording[]} recordings - One per browser, in the order the video
 * shows them.
 * @param {Language} language - The language of the captions.
 * @returns {DemoVideoPlan} The sections and the length of the whole video.
 */
export const planDemoVideo = (
  recordings: Recording[],
  language: Language = "ja",
): DemoVideoPlan => {
  const captions = CAPTIONS[language];
  checkRecordings(recordings, captions);

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

  const durations = recordings.map(
    (recording) => CAPTION_SECONDS + recording.durationSeconds * stretch,
  );
  const sections = recordings.map((recording, index): Section => {
    const startSeconds = sum(durations.slice(0, index));

    return {
      project: recording.project,
      startSeconds,
      durationSeconds: durations[index] ?? 0,
      stretch,
      caption: {
        text: captions.get(recording.project) ?? recording.project,
        subtitle: `${String(index + 1)} / ${String(recordings.length)}`,
        startSeconds,
        durationSeconds: CAPTION_SECONDS,
      },
    };
  });

  return { sections, totalSeconds };
};

/**
 * Whether a directory Playwright wrote holds the recording of a project.
 * Playwright ends each test's output directory with the project name, every
 * run of other characters turned into one "-".
 * @param {string} directoryName - The directory's own name, not its path.
 * @param {string} project - The Playwright project name.
 * @returns {boolean} True when the directory belongs to that project.
 */
export const isRecordingDirectoryOf = (
  directoryName: string,
  project: string,
): boolean =>
  directoryName.endsWith(`-${project.replace(/[^A-Za-z0-9]+/g, "-")}`);

/**
 * Picks each project's recording directory, in the order of the projects
 * rather than the order the file system lists them, which is the order the
 * video shows.
 * @param {string[]} projects - The Playwright project names, in video order.
 * @param {string[]} directoryNames - The directories the recording run wrote.
 * @returns {string[]} One directory name per project, in the same order.
 */
export const recordingDirectoriesFor = (
  projects: string[],
  directoryNames: string[],
): string[] =>
  projects.map((project) => {
    const matches = directoryNames.filter((name) =>
      isRecordingDirectoryOf(name, project),
    );
    const [only] = matches;

    if (matches.length !== 1 || only === undefined) {
      throw new Error(
        `Expected one recording of ${project}, found ${String(matches.length)}; run bun run record:demo first.`,
      );
    }

    return only;
  });

/**
 * The files edit:demo writes beside the video, for upload:demo to read.
 * @param {string} videoFile - The edited video's path.
 * @returns {{ plan: string, thumbnail: string, upload: string }} The plan the
 * video was encoded from, its thumbnail, and the record of its upload.
 */
export const companionFiles = (
  videoFile: string,
): { plan: string; thumbnail: string; upload: string } => {
  const base = videoFile.replace(/\.[^./\\]+$/, "");

  return {
    plan: `${base}.plan.json`,
    thumbnail: `${base}.thumbnail.jpg`,
    upload: `${base}.youtube.json`,
  };
};

// Far enough into the first recording that the journey shows a generated
// result, which says more about the site than its empty start screen.
const THUMBNAIL_SECONDS_INTO_RECORDING = 17;

/**
 * Where in the edited video the thumbnail frame is taken.
 * @param {DemoVideoPlan} plan - The plan the video was encoded from.
 * @returns {number} Seconds from the start of the video.
 */
export const thumbnailSeconds = (plan: DemoVideoPlan): number => {
  const [first] = plan.sections;
  if (first === undefined) {
    throw new Error("A plan with no sections has no thumbnail");
  }
  const recordingStart = first.startSeconds + first.caption.durationSeconds;
  const recordingEnd = first.startSeconds + first.durationSeconds;

  return Math.min(
    recordingStart + THUMBNAIL_SECONDS_INTO_RECORDING,
    recordingEnd - 1,
  );
};

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const BACKGROUND = "0x1c1917";

const escaping =
  (special: RegExp) =>
  (value: string): string =>
    value.replace(special, (character) => `\\${character}`);

/**
 * Escapes a value for a filter option inside -filter_complex. ffmpeg unescapes
 * it twice: first as the filter graph (where , ; [ ] end a filter or name a
 * pad), then as the filter's options (where : ends an option). Single quotes
 * are not used, because inside them a backslash is kept literally, so a quote
 * in the value could never be escaped.
 * @param {string} value - The option value as it should reach the filter.
 * @returns {string} The value to write after `option=`.
 */
export const filterOptionValue = (value: string): string =>
  escaping(/[\\'[\],;]/g)(escaping(/[\\':]/g)(value));

// drawtext reads its text a third time, expanding %{...} and \ sequences.
const drawtextText = (value: string) =>
  filterOptionValue(escaping(/[\\%]/g)(value));

type EncodeRequest = {
  plan: DemoVideoPlan;
  /** One per section, in the same order. */
  videoFiles: string[];
  outputFile: string;
  /** A font with Japanese glyphs; the captions are tofu without one. */
  fontFile: string;
};

const THUMBNAIL_TEXTS: Record<Language, string> = {
  ja: "6つのブラウザで使う Zipnami",
  en: "Zipnami in 6 browsers",
};

/**
 * The words on the thumbnail of the video in a language.
 * @param {Language} language - The video's language.
 * @returns {string} The words drawn on the thumbnail's band.
 */
export const thumbnailText = (language: Language): string =>
  THUMBNAIL_TEXTS[language];

/** The words on the Japanese thumbnail. */
export const THUMBNAIL_TEXT = thumbnailText("ja");

/**
 * The ffmpeg arguments that take the thumbnail from the edited video: one
 * 1280x720 frame (YouTube's recommended size) with the title drawn on a band.
 * @param {{ videoFile: string, atSeconds: number, outputFile: string, fontFile: string, language?: Language }} request -
 * The video, where the frame is, the JPEG to write, the font, and the
 * language of the title (Japanese when not given).
 * @returns {string[]} Arguments for ffmpeg, without the program name.
 */
export const thumbnailArguments = (request: {
  videoFile: string;
  atSeconds: number;
  outputFile: string;
  fontFile: string;
  language?: Language;
}): string[] => [
  "-y",
  "-ss",
  String(request.atSeconds),
  "-i",
  request.videoFile,
  "-frames:v",
  "1",
  "-vf",
  [
    "scale=1280:720",
    `drawbox=x=0:y=ih-180:w=iw:h=180:color=${BACKGROUND}@0.88:t=fill`,
    `drawtext=fontfile=${filterOptionValue(request.fontFile)}:text=${drawtextText(thumbnailText(request.language ?? "ja"))}:fontcolor=white:fontsize=72:x=(w-text_w)/2:y=h-90-text_h/2`,
  ].join(","),
  "-q:v",
  "3",
  request.outputFile,
];

/**
 * The ffmpeg arguments that encode a plan into one video.
 * @param {EncodeRequest} request - The plan, its recordings, the output, and
 * the caption font.
 * @returns {string[]} Arguments for ffmpeg, without the program name.
 */
export const ffmpegArguments = (request: EncodeRequest): string[] => {
  const { plan, videoFiles, outputFile, fontFile } = request;

  if (videoFiles.length !== plan.sections.length) {
    throw new Error(
      `${String(plan.sections.length)} sections need ${String(plan.sections.length)} recordings, got ${String(videoFiles.length)}`,
    );
  }

  const font = `fontfile=${filterOptionValue(fontFile)}`;
  const chains = plan.sections.flatMap((section, index) => [
    `color=c=${BACKGROUND}:s=${String(WIDTH)}x${String(HEIGHT)}:r=${String(FPS)}:d=${String(section.caption.durationSeconds)},` +
      `drawtext=${font}:text=${drawtextText(section.caption.text)}:fontcolor=white:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2-60,` +
      `drawtext=${font}:text=${drawtextText(section.caption.subtitle)}:fontcolor=0xd6d3d1:fontsize=48:x=(w-text_w)/2:y=h/2+80,` +
      `setsar=1,format=yuv420p[caption${String(index)}]`,
    `[${String(index)}:v]setpts=${String(section.stretch)}*(PTS-STARTPTS),fps=${String(FPS)},` +
      `scale=${String(WIDTH)}:${String(HEIGHT)}:force_original_aspect_ratio=decrease,` +
      `pad=${String(WIDTH)}:${String(HEIGHT)}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND},` +
      `setsar=1,format=yuv420p[recording${String(index)}]`,
  ]);
  const joined =
    plan.sections
      .map((_, index) => `[caption${String(index)}][recording${String(index)}]`)
      .join("") + `concat=n=${String(plan.sections.length * 2)}:v=1:a=0[video]`;

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
