/*
 * Builds the edited v1.0.0 demo video from the six recordings that
 * `bun run record:demo` keeps (Issue #132, step 4).
 *
 * Usage: bun run edit:demo
 *
 * Needs ffmpeg and ffprobe on PATH. The video is written outside git, next to
 * the recordings, and its length is measured again after encoding, so a build
 * that came out shorter or longer than 2 to 4 minutes fails here rather than
 * on YouTube.
 *
 * Settings, all optional:
 * - RECORDING_OUTPUT_DIR: where the recordings are (the recording config's
 *   own setting, so both commands agree on one place).
 * - DEMO_VIDEO_OUTPUT: the video to write.
 * - DEMO_VIDEO_FONT: a font with Japanese glyphs for the captions.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { browserProjects } from "../playwright.projects.ts";
import {
  companionFiles,
  ffmpegArguments,
  MAX_TOTAL_SECONDS,
  MIN_TOTAL_SECONDS,
  planDemoVideo,
  recordingDirectoriesFor,
  thumbnailArguments,
  thumbnailSeconds,
} from "./demo-video-plan.ts";

const mediaDirectory = path.join(homedir(), ".zipnami-media", "v1.0.0");
const recordingsDirectory =
  process.env.RECORDING_OUTPUT_DIR ?? path.join(mediaDirectory, "recordings");
const outputFile =
  process.env.DEMO_VIDEO_OUTPUT ??
  path.join(mediaDirectory, "zipnami-v1.0.0-demo.mp4");
// Meiryo ships with every Japanese-capable Windows, the machine this is run
// on; elsewhere, name a font with DEMO_VIDEO_FONT.
const fontFile = process.env.DEMO_VIDEO_FONT ?? "C:/Windows/Fonts/meiryo.ttc";

const durationOf = (file: string): number =>
  Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        file,
      ],
      { encoding: "utf8" },
    ).trim(),
  );

const main = () => {
  if (!existsSync(fontFile)) {
    throw new Error(
      `Caption font not found: ${fontFile}. Set DEMO_VIDEO_FONT to a font with Japanese glyphs.`,
    );
  }

  const projects = browserProjects.map((project) => project.name ?? "");
  const directories = readdirSync(recordingsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const videoFiles = recordingDirectoriesFor(projects, directories).map(
    (directory) => path.join(recordingsDirectory, directory, "video.webm"),
  );
  const plan = planDemoVideo(
    projects.map((project, index) => ({
      project,
      durationSeconds: durationOf(videoFiles[index] ?? ""),
    })),
  );

  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-stats",
      ...ffmpegArguments({ plan, videoFiles, outputFile, fontFile }),
    ],
    { stdio: "inherit" },
  );

  const builtSeconds = durationOf(outputFile);
  if (builtSeconds < MIN_TOTAL_SECONDS || builtSeconds > MAX_TOTAL_SECONDS) {
    throw new Error(
      `The video came out ${builtSeconds.toFixed(1)} s long, outside 2 to 4 minutes.`,
    );
  }

  // upload:demo reads both: the plan for the chapters, so they follow the
  // video that was built rather than the recordings as they are now.
  const companions = companionFiles(outputFile);
  writeFileSync(companions.plan, `${JSON.stringify(plan, null, 2)}\n`);
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      ...thumbnailArguments({
        videoFile: outputFile,
        atSeconds: thumbnailSeconds(plan),
        outputFile: companions.thumbnail,
        fontFile,
      }),
    ],
    { stdio: "inherit" },
  );

  console.error(`Demo video: ${outputFile} (${builtSeconds.toFixed(1)} s)`);
  console.error(`Thumbnail: ${companions.thumbnail}`);
};

try {
  main();
} catch (error) {
  const notInstalled =
    error instanceof Error && "code" in error && error.code === "ENOENT";
  console.error(
    notInstalled
      ? "ffmpeg or ffprobe was not found. Install ffmpeg (for example, winget install Gyan.FFmpeg) and make sure both are on PATH."
      : error instanceof Error
        ? error.message
        : error,
  );
  process.exit(1);
}
