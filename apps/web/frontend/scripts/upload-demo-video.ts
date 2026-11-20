/*
 * Uploads the edited v1.0.0 demo video to YouTube as private, with its
 * chapters and thumbnail (Issue #132, step 5), in Japanese or English
 * (Issue #165).
 *
 * Usage: bun run upload:demo      (after bun run edit:demo)
 *        bun run upload:demo en   (after bun run edit:demo en)
 *
 * Reads ZIPNAMI_YOUTUBE_CLIENT_ID, ZIPNAMI_YOUTUBE_CLIENT_SECRET, and
 * ZIPNAMI_YOUTUBE_REFRESH_TOKEN (see authorize-youtube.ts for the last).
 * Never prints them: every message from Google passes through redactSecrets
 * first, since an error printed in a terminal is easily pasted into an Issue.
 *
 * Records its progress beside the video and never sends the video twice: a
 * run after a thumbnail failure sets only the thumbnail, and a run after an
 * upload that may have half-finished stops and asks for a look at Studio.
 * Each language has its own video file and so its own record: uploading the
 * English video never reads the Japanese one's record as its own.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import {
  companionFiles,
  demoLanguage,
  demoVideoFile,
} from "./demo-video-plan.ts";
import {
  type ChapterSource,
  CREDENTIAL_VARIABLES,
  nextUploadAction,
  redactSecrets,
  type UploadRecord,
  type UploadStep,
  uploadSteps,
  videoResource,
  xPost,
} from "./demo-video-upload.ts";

const language = demoLanguage(process.argv[2]);
const videoFile =
  process.env.DEMO_VIDEO_OUTPUT ??
  demoVideoFile(path.join(homedir(), ".zipnami-media", "v1.0.0"), language);
const companions = companionFiles(videoFile);

const credentials = {
  clientId: process.env[CREDENTIAL_VARIABLES.clientId] ?? "",
  clientSecret: process.env[CREDENTIAL_VARIABLES.clientSecret] ?? "",
  refreshToken: process.env[CREDENTIAL_VARIABLES.refreshToken] ?? "",
};
// Filled in once the token request answers, so later errors redact it too.
const secrets = [credentials.clientSecret, credentials.refreshToken];

const record = (progress: UploadRecord) => {
  writeFileSync(companions.upload, `${JSON.stringify(progress, null, 2)}\n`);
};

const studioUrl = (videoId: string) =>
  `https://studio.youtube.com/video/${encodeURIComponent(videoId)}/edit`;

const stepUrl = (name: UploadStep["name"]): string => {
  const step = uploadSteps().find((candidate) => candidate.name === name);
  if (step === undefined) {
    throw new Error(`No upload step named ${name}`);
  }

  return step.url;
};

const failIfNotOk = async (response: Response, step: string) => {
  if (!response.ok) {
    throw new Error(
      `${step} failed with HTTP ${String(response.status)}: ${redactSecrets(await response.text(), secrets)}`,
    );
  }
};

const accessToken = async (): Promise<string> => {
  const response = await fetch(stepUrl("token"), {
    method: "POST",
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  await failIfNotOk(response, "Refreshing the access token");
  const { access_token: token } = (await response.json()) as {
    access_token?: string;
  };
  if (token === undefined) {
    throw new Error(
      "Google answered the token request without an access token",
    );
  }
  secrets.push(token);

  return token;
};

const uploadVideo = async (token: string, plan: ChapterSource) => {
  const started = await fetch(stepUrl("video"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(statSync(videoFile).size),
    },
    body: JSON.stringify(videoResource(plan, language)),
  });
  await failIfNotOk(started, "Starting the upload");
  const location = started.headers.get("location");
  if (location === null) {
    throw new Error("YouTube started the upload without an upload address");
  }

  const uploaded = await fetch(location, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body: readFileSync(videoFile),
  });
  await failIfNotOk(uploaded, "Uploading the video");
  const { id } = (await uploaded.json()) as { id?: string };
  if (id === undefined) {
    throw new Error("YouTube accepted the video without returning its ID");
  }

  return id;
};

const setThumbnail = async (token: string, videoId: string) => {
  const response = await fetch(
    `${stepUrl("thumbnail")}&videoId=${encodeURIComponent(videoId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "image/jpeg",
      },
      body: readFileSync(companions.thumbnail),
    },
  );
  await failIfNotOk(response, "Setting the thumbnail");
};

const printXPost = (videoId: string) => {
  console.error(
    `X post, for when the video is public:\n${xPost(videoId, language)}`,
  );
};

const main = async () => {
  const missing = Object.entries(CREDENTIAL_VARIABLES)
    .filter(([key]) => credentials[key as keyof typeof credentials] === "")
    .map(([, variable]) => variable);
  if (missing.length > 0) {
    throw new Error(`Not set: ${missing.join(", ")}`);
  }
  for (const file of [videoFile, companions.plan, companions.thumbnail]) {
    if (!existsSync(file)) {
      throw new Error(`${file} is missing; run bun run edit:demo first.`);
    }
  }
  const action = nextUploadAction(
    existsSync(companions.upload)
      ? (JSON.parse(readFileSync(companions.upload, "utf8")) as UploadRecord)
      : undefined,
  );
  if (action.kind === "stop") {
    throw new Error(`${action.reason} (${companions.upload})`);
  }
  if (action.kind === "nothing") {
    console.error(
      `Already uploaded with its thumbnail: ${studioUrl(action.videoId)}`,
    );
    printXPost(action.videoId);
    return;
  }

  const token = await accessToken();
  const videoId =
    action.kind === "thumbnail"
      ? action.videoId
      : await (async () => {
          const plan = JSON.parse(
            readFileSync(companions.plan, "utf8"),
          ) as ChapterSource;
          record({ state: "started" });
          const id = await uploadVideo(token, plan);
          record({ state: "uploaded", videoId: id });
          return id;
        })();
  // A thumbnail failure (for example, a channel not yet verified for custom
  // thumbnails) leaves the record at "uploaded", so the next run sets only
  // the thumbnail.
  await setThumbnail(token, videoId);
  record({ state: "done", videoId });

  console.error(`Uploaded as private: ${studioUrl(videoId)}`);
  printXPost(videoId);
};

main().catch((error: unknown) => {
  console.error(
    redactSecrets(
      error instanceof Error ? error.message : String(error),
      secrets,
    ),
  );
  process.exit(1);
});
