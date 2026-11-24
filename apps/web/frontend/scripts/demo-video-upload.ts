/*
 * What the v1.0.0 demo upload sends to YouTube (Issue #132, step 5), kept
 * free of the network and the file system so it can be tested on CI, which
 * never holds the owner's credentials. upload-demo-video.ts sends it;
 * authorize-youtube.ts gets the refresh token it sends with.
 * The English video (Issue #165) is sent the same way, with English words.
 */

import type { Language } from "./demo-video-plan.ts";

export const SITE_URL = "https://zipnami.pages.dev";

/** The only scope the upload needs; thumbnails.set accepts it too. */
export const UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

export const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** The environment variables the upload and the authorization read. */
export const CREDENTIAL_VARIABLES = {
  clientId: "ZIPNAMI_YOUTUBE_CLIENT_ID",
  clientSecret: "ZIPNAMI_YOUTUBE_CLIENT_SECRET",
  refreshToken: "ZIPNAMI_YOUTUBE_REFRESH_TOKEN",
} as const;

/** The parts of the edit plan the upload reads. */
export type ChapterSource = {
  sections: { startSeconds: number; caption: { text: string } }[];
};

export type VideoResource = {
  snippet: {
    title: string;
    description: string;
    categoryId: string;
    defaultLanguage: string;
    defaultAudioLanguage: string;
  };
  status: { privacyStatus: "private"; selfDeclaredMadeForKids: false };
};

const TITLE =
  "Zipnami を6つのブラウザで使ってみた｜ランダム郵便番号ジェネレーター v1.0.0";

type Words = {
  title: string;
  /** The lines above the chapters. */
  introduction: string[];
};

const WORDS: Record<Language, Words> = {
  ja: {
    title: TITLE,
    introduction: [
      "Zipnami（ジップナミ）は、日本の実在する郵便番号をランダムに1つ選び、その住所を地図と一緒に表示するWebサイトです。",
      SITE_URL,
      "",
      "この動画では、同じ操作（郵便番号を出す → 住所を見る → もう一度出す → 住所をコピーする → ガイドを開く → トップへ戻る）を、6つのブラウザで順に行っています。",
    ],
  },
  en: {
    title: "Trying Zipnami in six browsers",
    introduction: [
      "Zipnami picks one real Japanese postal code at random and shows its address on a map.",
      SITE_URL,
      // The recordings show the site as it is, and it has no English yet
      // (Issue #162); saying so keeps a viewer from expecting otherwise.
      "The site is in Japanese for now.",
      "",
      "In this video, the same steps (get a postal code, read its address, get another, copy the address, open the guide, go back to the top) are done in six browsers, one after another.",
    ],
  },
};

const X_POSTS: Record<Language, (url: string) => string> = {
  ja: (url) => `Zipnami を6つのブラウザで使ってみました。 ${url} #Zipnami`,
  en: (url) =>
    `Zipnami picks a random real Japanese postal code. Here it is in six browsers: ${url} #Zipnami`,
};

// YouTube reads a line as a chapter when it starts with m:ss (or h:mm:ss).
const timestamp = (seconds: number) => {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");

  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${String(minutes)}:${rest}`;
};

/**
 * The video resource sent with the upload: private, in the video's language,
 * with one chapter per browser section.
 * @param {ChapterSource} plan - The plan edit:demo encoded the video from.
 * @param {Language} language - The video's language (Japanese when not given).
 * @returns {VideoResource} The snippet and status parts of the resource.
 */
export const videoResource = (
  plan: ChapterSource,
  language: Language = "ja",
): VideoResource => ({
  snippet: {
    title: WORDS[language].title,
    description: [
      ...WORDS[language].introduction,
      "",
      ...plan.sections.map(
        (section) =>
          `${timestamp(section.startSeconds)} ${section.caption.text}`,
      ),
    ].join("\n"),
    // Science & Technology.
    categoryId: "28",
    defaultLanguage: language,
    defaultAudioLanguage: language,
  },
  status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
});

/**
 * The link to share a video by.
 * @param {string} videoId - The ID YouTube gave the upload.
 * @returns {string} The short watch link.
 */
export const youtubeUrl = (videoId: string): string =>
  `https://youtu.be/${encodeURIComponent(videoId)}`;

/**
 * The X post the owner shares the video with: one sentence, the link, and
 * #Zipnami, short as the owner asked for release posts (2026-11-19).
 * @param {string} videoId - The ID YouTube gave the upload.
 * @param {Language} language - The video's language.
 * @returns {string} The text to post.
 */
export const xPost = (videoId: string, language: Language): string =>
  X_POSTS[language](youtubeUrl(videoId));

export type UploadStep = {
  name: "token" | "video" | "thumbnail";
  url: string;
};

/**
 * The requests the upload makes, in order. The thumbnail is set on the video
 * the second request created, so it comes last.
 * @returns {UploadStep[]} One entry per request.
 */
export const uploadSteps = (): UploadStep[] => [
  { name: "token", url: TOKEN_URL },
  {
    name: "video",
    url: "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
  },
  {
    name: "thumbnail",
    url: "https://www.googleapis.com/upload/youtube/v3/thumbnails/set?uploadType=media",
  },
];

/**
 * How far an earlier run got, as upload-demo-video.ts records it beside the
 * video. "started" is written before the video is sent, so a run that dies
 * mid-upload is never mistaken for one that never began.
 */
export type UploadRecord =
  | { state: "started" }
  | { state: "uploaded"; videoId: string }
  | { state: "done"; videoId: string };

export type UploadAction =
  | { kind: "upload" }
  | { kind: "thumbnail"; videoId: string }
  | { kind: "nothing"; videoId: string }
  | { kind: "stop"; reason: string };

/**
 * What a run does, given how far the last one got. Never uploads the video a
 * second time: a run that stopped after sending may already have created it.
 * @param {UploadRecord | undefined} record - The record, if one exists.
 * @returns {UploadAction} The one thing this run does.
 */
export const nextUploadAction = (
  record: UploadRecord | undefined,
): UploadAction => {
  if (record === undefined) {
    return { kind: "upload" };
  }
  switch (record.state) {
    case "started":
      return {
        kind: "stop",
        reason:
          "An earlier upload started but did not finish. Check YouTube Studio for a private copy before deleting the upload record to try again.",
      };
    case "uploaded":
      return { kind: "thumbnail", videoId: record.videoId };
    case "done":
      return { kind: "nothing", videoId: record.videoId };
  }
};

/**
 * Removes every secret from text before it is printed. Google's error bodies
 * can echo what was sent, and an error printed in a terminal is easily pasted
 * into an Issue.
 * @param {string} text - What is about to be printed.
 * @param {string[]} secrets - The values that must not appear.
 * @returns {string} The text with each secret replaced.
 */
export const redactSecrets = (text: string, secrets: string[]): string =>
  secrets
    // An empty or very short value would redact ordinary text, and no real
    // credential is that short.
    .filter((secret) => secret.length >= 8)
    .reduce(
      (redacted, secret) => redacted.replaceAll(secret, "[redacted]"),
      text,
    );

/**
 * The consent page for authorize-youtube.ts, for a Desktop OAuth client that
 * redirects to a loopback address. PKCE (S256) as well as state, as Google
 * recommends for installed apps: another process on the machine that catches
 * the code still cannot exchange it.
 * @param {{ clientId: string, redirectUri: string, state: string, codeChallenge: string }} request -
 * The client, where Google sends the code, a value to match it against, and
 * the S256 challenge of the verifier the exchange will send.
 * @returns {string} The URL the owner opens once.
 */
export const authorizationUrl = (request: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string =>
  `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: "code",
    scope: UPLOAD_SCOPE,
    // offline and consent: without both, Google returns no refresh token on
    // a second authorization.
    access_type: "offline",
    prompt: "consent",
    state: request.state,
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
  }).toString()}`;
