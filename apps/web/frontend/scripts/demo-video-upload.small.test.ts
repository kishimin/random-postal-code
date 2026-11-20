import { describe, expect, it } from "vitest";
import {
  authorizationUrl,
  nextUploadAction,
  redactSecrets,
  UPLOAD_SCOPE,
  videoResource,
  xPost,
  youtubeUrl,
} from "./demo-video-upload.ts";

const planStartingAt = (...starts: number[]) => ({
  sections: starts.map((startSeconds, index) => ({
    startSeconds,
    caption: { text: `ブラウザ ${String(index + 1)}` },
  })),
});

const chapterLines = (starts: number[]) =>
  videoResource(planStartingAt(...starts))
    .snippet.description.split("\n")
    .filter((line) => line.includes("ブラウザ "));

describe("videoResource", () => {
  it("writes each chapter as minutes and two-digit seconds, rounded down", () => {
    expect(chapterLines([0, 35.9, 71.2, 605])).toEqual([
      "0:00 ブラウザ 1",
      "0:35 ブラウザ 2",
      "1:11 ブラウザ 3",
      "10:05 ブラウザ 4",
    ]);
  });

  it("adds hours once a chapter starts an hour in", () => {
    expect(chapterLines([0, 3725])).toEqual([
      "0:00 ブラウザ 1",
      "1:02:05 ブラウザ 2",
    ]);
  });

  it("does not let any other line of the description read as a chapter", () => {
    const description = videoResource(planStartingAt(0, 40)).snippet
      .description;
    const timestamped = description
      .split("\n")
      .filter((line) => /^\d+:\d{2}/.test(line));

    expect(timestamped).toEqual(["0:00 ブラウザ 1", "0:40 ブラウザ 2"]);
  });

  it("declares the video Japanese and not made for kids", () => {
    const resource = videoResource(planStartingAt(0));

    expect(resource.snippet.defaultLanguage).toBe("ja");
    expect(resource.snippet.defaultAudioLanguage).toBe("ja");
    expect(resource.status.selfDeclaredMadeForKids).toBe(false);
  });

  it("keeps the title within YouTube's 100 characters", () => {
    expect(
      [...videoResource(planStartingAt(0)).snippet.title].length,
    ).toBeLessThanOrEqual(100);
  });
});

describe("videoResource in English", () => {
  const english = videoResource(planStartingAt(0, 40), "en");

  it("declares the video English", () => {
    expect(english.snippet.defaultLanguage).toBe("en");
    expect(english.snippet.defaultAudioLanguage).toBe("en");
  });

  it("keeps the title within YouTube's 100 characters", () => {
    expect([...english.snippet.title].length).toBeLessThanOrEqual(100);
  });

  it("uses the plan's captions as the chapter titles", () => {
    expect(
      english.snippet.description
        .split("\n")
        .filter((line) => /^\d+:\d{2}/.test(line)),
    ).toEqual(["0:00 ブラウザ 1", "0:40 ブラウザ 2"]);
  });

  it("is the same upload apart from its words", () => {
    const japanese = videoResource(planStartingAt(0, 40));

    expect(english.status).toEqual(japanese.status);
    expect(english.snippet.categoryId).toBe(japanese.snippet.categoryId);
  });
});

describe("youtubeUrl", () => {
  it("is the short watch link, with the ID escaped", () => {
    expect(youtubeUrl("fu29xlvOFZ8")).toBe("https://youtu.be/fu29xlvOFZ8");
    expect(youtubeUrl("a/b")).toBe("https://youtu.be/a%2Fb");
  });
});

describe("xPost", () => {
  it("is one sentence, the video link, and #Zipnami", () => {
    expect(xPost("abc", "en")).toBe(
      "Zipnami picks a random real Japanese postal code. Here it is in six browsers: https://youtu.be/abc #Zipnami",
    );
  });

  it("has a Japanese post for the Japanese video", () => {
    expect(xPost("abc", "ja")).toContain("https://youtu.be/abc");
    expect(xPost("abc", "ja")).toContain("#Zipnami");
    expect(xPost("abc", "ja")).not.toBe(xPost("abc", "en"));
  });
});

describe("redactSecrets", () => {
  it("replaces every occurrence of a secret", () => {
    expect(
      redactSecrets("a=ya29.token-1 b=ya29.token-1", ["ya29.token-1"]),
    ).toBe("a=[redacted] b=[redacted]");
  });

  it("ignores empty and very short values, which would redact ordinary text", () => {
    expect(redactSecrets("status 400: bad", ["", "a", "400"])).toBe(
      "status 400: bad",
    );
  });
});

describe("nextUploadAction", () => {
  it("uploads when no earlier run left a record", () => {
    expect(nextUploadAction(undefined)).toEqual({ kind: "upload" });
  });

  it("sets only the thumbnail when the video went up but the thumbnail did not", () => {
    expect(nextUploadAction({ state: "uploaded", videoId: "abc" })).toEqual({
      kind: "thumbnail",
      videoId: "abc",
    });
  });

  it("does nothing once the video and its thumbnail are up", () => {
    expect(nextUploadAction({ state: "done", videoId: "abc" })).toEqual({
      kind: "nothing",
      videoId: "abc",
    });
  });

  it("stops rather than upload again when an earlier upload may have half-finished", () => {
    const action = nextUploadAction({ state: "started" });

    expect(action.kind).toBe("stop");
  });
});

describe("authorizationUrl", () => {
  const url = new URL(
    authorizationUrl({
      clientId: "client.apps.googleusercontent.com",
      redirectUri: "http://127.0.0.1:53682",
      state: "state-123",
      codeChallenge: "challenge-abc",
    }),
  );

  it("binds the code to a PKCE S256 challenge", () => {
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("asks only for the upload scope", () => {
    expect(url.searchParams.get("scope")).toBe(UPLOAD_SCOPE);
  });

  it("asks for a refresh token even on a second authorization", () => {
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("sends the code back to the loopback address with the state", () => {
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:53682");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("response_type")).toBe("code");
  });
});
