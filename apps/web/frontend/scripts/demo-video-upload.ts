/*
 * What the v1.0.0 demo upload sends to YouTube (Issue #132, step 5), kept
 * free of the network and the file system so it can be tested on CI, which
 * never holds the owner's credentials. upload-demo-video.ts sends it;
 * authorize-youtube.ts gets the refresh token it sends with.
 */

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
 * The video resource sent with the upload: private, in Japanese, with one
 * chapter per browser section.
 * @param {ChapterSource} plan - The plan edit:demo encoded the video from.
 * @returns {VideoResource} The snippet and status parts of the resource.
 */
export const videoResource = (plan: ChapterSource): VideoResource => ({
  snippet: {
    title: TITLE,
    description: [
      "Zipnami（ジップナミ）は、日本の実在する郵便番号をランダムに1つ選び、その住所を地図と一緒に表示するWebサイトです。",
      SITE_URL,
      "",
      "この動画では、同じ操作（郵便番号を出す → 住所を見る → もう一度出す → 住所をコピーする → ガイドを開く → トップへ戻る）を、6つのブラウザで順に行っています。",
      "",
      ...plan.sections.map(
        (section) =>
          `${timestamp(section.startSeconds)} ${section.caption.text}`,
      ),
    ].join("\n"),
    // Science & Technology.
    categoryId: "28",
    defaultLanguage: "ja",
    defaultAudioLanguage: "ja",
  },
  status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
});

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
 * redirects to a loopback address.
 * @param {{ clientId: string, redirectUri: string, state: string }} request -
 * The client, where Google sends the code, and a value to match it against.
 * @returns {string} The URL the owner opens once.
 */
export const authorizationUrl = (request: {
  clientId: string;
  redirectUri: string;
  state: string;
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
  }).toString()}`;
