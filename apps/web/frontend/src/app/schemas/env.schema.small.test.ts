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

  // design.md section 7: Google Maps is an optional dependency of the Web
  // experience, so a build that never configured a key must still succeed --
  // unlike VITE_API_BASE_URL, this is not fatal.
  test("returns an empty Maps API key when it is not configured", () => {
    const env = parseAppEnv({
      VITE_API_BASE_URL: "https://api.example.com",
    });

    expect(env.mapsApiKey).toBe("");
  });

  test("returns the configured Maps API key", () => {
    const env = parseAppEnv({
      VITE_API_BASE_URL: "https://api.example.com",
      VITE_GOOGLE_MAPS_API_KEY: "test-maps-key",
    });

    expect(env.mapsApiKey).toBe("test-maps-key");
  });
});
