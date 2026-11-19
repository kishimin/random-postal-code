import { describe, expect, it } from "vitest";
import {
  authorizationUrl,
  redactSecrets,
  UPLOAD_SCOPE,
  videoResource,
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

describe("authorizationUrl", () => {
  const url = new URL(
    authorizationUrl({
      clientId: "client.apps.googleusercontent.com",
      redirectUri: "http://127.0.0.1:53682",
      state: "state-123",
    }),
  );

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
