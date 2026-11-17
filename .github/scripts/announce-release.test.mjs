import assert from "node:assert/strict";
import { test } from "node:test";

import {
  announceRelease,
  latestXPost,
  validateXPost,
  weightedLength,
} from "./announce-release.mjs";

const SITE = "https://zipnami.pages.dev";
const WEBHOOK = "https://discord.example.test/api/webhooks/1/secret-token";

const recordingFetch = (response = { ok: true, status: 204 }) => {
  const calls = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return response;
    },
  };
};

const xPost = (text) => ({ body: `<!-- x-post -->\n${text}` });

test("Latin letters weigh 1 and CJK characters weigh 2", () => {
  assert.equal(weightedLength("abc"), 3);
  assert.equal(weightedLength("郵便番号"), 8);
  assert.equal(weightedLength("、。"), 4);
  // General punctuation such as the em dash is in a range X weighs 1.
  assert.equal(weightedLength("—"), 1);
});

test("each URL weighs 23 however long it is", () => {
  assert.equal(weightedLength(SITE), 23);
  assert.equal(weightedLength(`${SITE}/guide/about-zipnami?from=x`), 23);
  assert.equal(
    weightedLength(`見て ${SITE} と ${SITE}`),
    2 * 2 + 1 + 23 + 1 + 2 + 1 + 23,
  );
});

test("a URL ends where the ASCII run ends, and trailing punctuation is text", () => {
  // X stops a URL at the first CJK character, so the characters after it
  // still weigh 2 each.
  assert.equal(weightedLength(`${SITE}で公開中`), 23 + 8);
  assert.equal(weightedLength(`${SITE}.`), 24);
  assert.equal(weightedLength(`(${SITE})`), 25);
});

test("an emoji outside the light ranges weighs 2", () => {
  assert.equal(weightedLength("🎉"), 2);
});

test("the latest x-post comment wins, and only comments that start with the marker count", () => {
  const comments = [
    xPost("first"),
    { body: "Quoting `<!-- x-post -->` in a discussion" },
    { body: "  <!-- x-post -->\r\nsecond\r\nline  \n" },
    { body: "LGTM" },
  ];
  assert.equal(latestXPost(comments), "second\nline");
  assert.equal(latestXPost([{ body: "LGTM" }]), undefined);
  assert.equal(latestXPost([]), undefined);
});

test("a text that is empty, too long, or without the site is refused", () => {
  assert.match(validateXPost(undefined) ?? "", /no <!-- x-post --> comment/);
  assert.match(validateXPost("") ?? "", /empty/);
  assert.match(validateXPost(`${"あ".repeat(129)} ${SITE}`) ?? "", /282/);
  assert.match(
    validateXPost("Zipnami を公開しました") ?? "",
    /zipnami\.pages\.dev/,
  );
  // A look-alike host is not the site.
  assert.match(
    validateXPost("https://zipnami.pages.dev.example.com を見て") ?? "",
    /zipnami\.pages\.dev/,
  );
  assert.equal(validateXPost(`${"あ".repeat(128)} ${SITE}`), undefined);
  assert.equal(validateXPost(`${SITE}/guide/about を見て`), undefined);
});

test("a valid post sends one message with the version, the text, and an intent link", async () => {
  const { calls, fetch } = recordingFetch();
  const text = `Zipnami 1.1.0 を公開しました & 100% 無料 #郵便番号\n${SITE}`;

  await announceRelease({
    version: "1.1.0",
    comments: [xPost(text)],
    webhookUrl: WEBHOOK,
    fetch,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, WEBHOOK);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  const payload = JSON.parse(calls[0].init.body);
  // A post that says @everyone must not ping the channel.
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.match(payload.content, /v1\.1\.0/);
  assert.ok(payload.content.includes(text));
  const [link] =
    payload.content.match(/https:\/\/x\.com\/intent\/post\?text=[^\s>]+/) ?? [];
  assert.equal(new URL(link).searchParams.get("text"), text);
});

test("nothing is sent when the post is invalid or the webhook is missing", async () => {
  for (const [why, options] of [
    ["no comment", { comments: [], webhookUrl: WEBHOOK }],
    ["no site", { comments: [xPost("hello")], webhookUrl: WEBHOOK }],
    ["no webhook", { comments: [xPost(SITE)], webhookUrl: "" }],
  ]) {
    const { calls, fetch } = recordingFetch();
    await assert.rejects(
      announceRelease({ version: "1.0.1", fetch, ...options }),
      why,
    );
    assert.equal(calls.length, 0, why);
  }
});

test("a Discord error or a network failure fails without naming the webhook", async () => {
  const failures = [
    recordingFetch({ ok: false, status: 404 }).fetch,
    async () => {
      throw new TypeError(`fetch failed for ${WEBHOOK}`);
    },
  ];
  for (const fetch of failures) {
    await assert.rejects(
      announceRelease({
        version: "1.0.1",
        comments: [xPost(SITE)],
        webhookUrl: WEBHOOK,
        fetch,
      }),
      (error) => {
        assert.ok(!String(error).includes("secret-token"), String(error));
        assert.ok(!String(error.cause ?? "").includes("secret-token"));
        return true;
      },
    );
  }
});
