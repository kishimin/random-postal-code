import { describe, expect, test } from "vitest";
import { parseAppEnv } from "./env.schema";

describe("parseAppEnv", () => {
  test("returns the API base URL when it is an absolute http URL", () => {
    const env = parseAppEnv({ VITE_API_BASE_URL: "https://api.example.com" });

    expect(env.apiBaseUrl).toBe("https://api.example.com");
  });

  test("accepts the http localhost URL .env.example documents", () => {
    // Local development points at wrangler dev over plain http. A rule that
    // allowed only https would reject the file the README tells you to copy.
    const env = parseAppEnv({ VITE_API_BASE_URL: "http://localhost:8787" });

    expect(env.apiBaseUrl).toBe("http://localhost:8787");
  });

  test("rejects a missing API base URL", () => {
    // A build that shipped without the variable would call undefined at
    // runtime. Failing here names the missing variable instead.
    expect(() => parseAppEnv({})).toThrow(/VITE_API_BASE_URL/);
  });

  test("rejects a value that is not a URL", () => {
    expect(() => parseAppEnv({ VITE_API_BASE_URL: "localhost:8787" })).toThrow(
      /VITE_API_BASE_URL/,
    );
  });

  test("rejects a relative path, which no browser could resolve against the API origin", () => {
    expect(() => parseAppEnv({ VITE_API_BASE_URL: "/api" })).toThrow(
      /VITE_API_BASE_URL/,
    );
  });

  // Issue #9: Google Maps, AdSense, and consent are optional dependencies
  // (design.md section 7), so an unset or malformed advertising variable must
  // never throw the way a missing VITE_API_BASE_URL does above -- that would
  // make an unrelated, optional config value block the whole build.
  test("defaults to test ads with a placeholder client id when neither AdSense variable is set", () => {
    const env = parseAppEnv({ VITE_API_BASE_URL: "https://api.example.com" });

    expect(env.useTestAds).toBe(true);
    expect(env.googleAdsenseClientId).toBeTruthy();
  });

  test("uses the configured AdSense client id when VITE_GOOGLE_ADSENSE_CLIENT_ID is set", () => {
    const env = parseAppEnv({
      VITE_API_BASE_URL: "https://api.example.com",
      VITE_GOOGLE_ADSENSE_CLIENT_ID: "ca-pub-1234567890123456",
    });

    expect(env.googleAdsenseClientId).toBe("ca-pub-1234567890123456");
  });

  test("serves live ads only when VITE_ADSENSE_TEST_MODE is exactly \"false\"", () => {
    const env = parseAppEnv({
      VITE_API_BASE_URL: "https://api.example.com",
      VITE_ADSENSE_TEST_MODE: "false",
    });

    expect(env.useTestAds).toBe(false);
  });

  test("treats any other VITE_ADSENSE_TEST_MODE value as test mode, failing safe", () => {
    const env = parseAppEnv({
      VITE_API_BASE_URL: "https://api.example.com",
      VITE_ADSENSE_TEST_MODE: "not-a-real-flag",
    });

    expect(env.useTestAds).toBe(true);
  });
});
