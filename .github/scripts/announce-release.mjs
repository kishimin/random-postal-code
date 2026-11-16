// Hands the owner a ready-to-post X link for a release (Issue #133).
// release.yml runs this in the run where release-please creates the tag and
// the GitHub Release. It reads the latest <!-- x-post --> comment on the
// merged release pull request, checks it the way X would, and posts the
// version, the text, and an x.com intent link to Discord. The owner reads it
// there and presses ポスト; nothing posts to X by itself (the X API has no free
// tier for new developers since 2026-02-06).
import { pathToFileURL } from "node:url";

export const X_POST_MARKER = "<!-- x-post -->";
export const SITE_ORIGIN = "https://zipnami.pages.dev";
export const MAX_WEIGHT = 280;

// X's counting rules (twitter-text v3): every URL weighs 23, a code point in
// these ranges weighs 1, and every other code point weighs 2. Counting an
// emoji sequence per code point can only over-count, which refuses a post X
// would accept rather than the other way round.
const URL_WEIGHT = 23;
const LIGHT_RANGES = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];
// A URL ends where the printable ASCII run ends: X stops it at the first CJK
// character, and leaves trailing punctuation out of it.
const URL_PATTERN = /https?:\/\/[\x21-\x7e]+/g;
const TRAILING_PUNCTUATION = /[.,!?:;'")\]}]+$/;

const urlsIn = (text) =>
  [...text.matchAll(URL_PATTERN)].map(([match]) => ({
    url: match.replace(TRAILING_PUNCTUATION, ""),
    trailing: match.length - match.replace(TRAILING_PUNCTUATION, "").length,
  }));

const weightOf = (character) => {
  const codePoint = character.codePointAt(0) ?? 0;
  return LIGHT_RANGES.some(
    ([low, high]) => codePoint >= low && codePoint <= high,
  )
    ? 1
    : 2;
};

export const weightedLength = (text) => {
  const normalized = text.normalize("NFC");
  let weight = urlsIn(normalized).length * URL_WEIGHT;
  // Each URL is replaced by its trailing punctuation, which is ordinary text.
  const rest = normalized.replace(URL_PATTERN, (match) =>
    match.slice(match.replace(TRAILING_PUNCTUATION, "").length),
  );
  for (const character of rest) {
    weight += weightOf(character);
  }
  return weight;
};

/** The text of the latest comment that starts with the marker, if any. */
export const latestXPost = (comments) => {
  const posts = comments
    .map(({ body }) => (body ?? "").replace(/\r\n/g, "\n").trim())
    .filter((body) => body.startsWith(X_POST_MARKER));
  const latest = posts.at(-1);
  return latest === undefined
    ? undefined
    : latest.slice(X_POST_MARKER.length).trim();
};

const linksToSite = (text) =>
  urlsIn(text).some(({ url }) => {
    try {
      return new URL(url).origin === SITE_ORIGIN;
    } catch {
      return false;
    }
  });

/** Why the text cannot be posted, or undefined when it can. */
export const validateXPost = (text) => {
  if (text === undefined) {
    return `The release pull request has no ${X_POST_MARKER} comment.`;
  }
  if (text === "") {
    return `The ${X_POST_MARKER} comment is empty.`;
  }
  const weight = weightedLength(text);
  if (weight > MAX_WEIGHT) {
    return `The X post weighs ${weight}, over X's limit of ${MAX_WEIGHT}.`;
  }
  if (!linksToSite(text)) {
    return `The X post does not link to ${SITE_ORIGIN}.`;
  }
  return undefined;
};

// Discord refuses a message over 2000 characters.
const DISCORD_LIMIT = 2000;

const messageFor = (version, text) => {
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
  // The angle brackets stop Discord from embedding a preview of the link.
  return [
    `**Zipnami v${version} をリリースしました — X への投稿待ち**`,
    "",
    "投稿する文:",
    text,
    "",
    `下のリンクを開くと、この文が入った X の投稿画面が開きます。確認してポストを押してください。`,
    `<${intent}>`,
  ].join("\n");
};

export const announceRelease = async ({
  version,
  comments,
  webhookUrl,
  fetch,
}) => {
  if (!webhookUrl) {
    throw new Error(
      "The Discord webhook secret ZIPNAMI_DISCORD_WEBHOOK_URL is not set.",
    );
  }
  const text = latestXPost(comments);
  const problem = validateXPost(text);
  if (problem !== undefined) {
    throw new Error(`${problem} Nothing was sent to Discord.`);
  }
  const content = messageFor(version, text);
  if (content.length > DISCORD_LIMIT) {
    throw new Error(
      `The Discord message is ${content.length} characters, over Discord's limit of ${DISCORD_LIMIT}. Nothing was sent.`,
    );
  }

  let response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
  } catch {
    // The original error is dropped, not chained: a network error names the
    // URL it failed to reach, and that URL is the webhook's secret.
    throw new Error("Could not reach the Discord webhook.");
  }
  if (!response.ok) {
    throw new Error(`Discord answered HTTP ${response.status}.`);
  }
};

const github = async (path, token) => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub answered HTTP ${response.status} for ${path}.`);
  }
  return response.json();
};

/** The release pull request merged as `sha`, found by release-please's branch prefix. */
const releasePullRequest = async (repository, sha, token) => {
  const pulls = await github(
    `/repos/${repository}/commits/${sha}/pulls`,
    token,
  );
  const pull = pulls.find((candidate) =>
    candidate.head?.ref?.startsWith("release-please--"),
  );
  if (pull === undefined) {
    throw new Error(`No release-please pull request was merged as ${sha}.`);
  }
  return pull.number;
};

const commentsOn = async (repository, number, token) => {
  const comments = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(
      `/repos/${repository}/issues/${number}/comments?per_page=100&page=${page}`,
      token,
    );
    comments.push(...batch);
    if (batch.length < 100) {
      return comments;
    }
  }
};

const main = async () => {
  const {
    GITHUB_REPOSITORY,
    GITHUB_TOKEN,
    RELEASE_SHA,
    VERSION,
    DISCORD_WEBHOOK_URL,
  } = process.env;
  const number = await releasePullRequest(
    GITHUB_REPOSITORY,
    RELEASE_SHA,
    GITHUB_TOKEN,
  );
  const comments = await commentsOn(GITHUB_REPOSITORY, number, GITHUB_TOKEN);
  await announceRelease({
    version: VERSION,
    comments,
    webhookUrl: DISCORD_WEBHOOK_URL,
    fetch,
  });
  console.log(`Announced v${VERSION} from #${number} on Discord.`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
