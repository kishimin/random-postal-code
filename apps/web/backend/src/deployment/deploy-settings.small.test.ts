import { describe, expect, test } from "vitest";
import { problemsWithAllowedOrigins } from "./deploy-settings.ts";

describe("problemsWithAllowedOrigins", () => {
  test("accepts exactly one https origin", () => {
    expect(problemsWithAllowedOrigins("https://zipnami.pages.dev")).toEqual([]);
  });

  test("accepts an origin with surrounding whitespace, as a pasted variable often has", () => {
    expect(problemsWithAllowedOrigins("  https://zipnami.pages.dev\n")).toEqual(
      [],
    );
  });

  test.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "],
  ])("refuses a %s allowlist", (_case, value) => {
    expect(problemsWithAllowedOrigins(value)).toEqual([
      "ALLOWED_ORIGINS is not set",
    ]);
  });

  test.each([
    ["a wildcard", "*"],
    ["a wildcard subdomain", "https://*.pages.dev"],
    ["plain http", "http://zipnami.pages.dev"],
    ["a trailing slash", "https://zipnami.pages.dev/"],
    ["a path", "https://zipnami.pages.dev/app"],
    ["a non-URL", "zipnami.pages.dev"],
    ["the opaque null origin", "null"],
  ])("refuses %s, which is not an exact https origin", (_case, value) => {
    expect(problemsWithAllowedOrigins(value)).toEqual([
      "ALLOWED_ORIGINS must be exactly one https origin, such as https://<project>.pages.dev",
    ]);
  });

  test("refuses more than one origin, since production has one Pages origin", () => {
    expect(
      problemsWithAllowedOrigins(
        "https://zipnami.pages.dev,https://other.pages.dev",
      ),
    ).toEqual([
      "ALLOWED_ORIGINS must be exactly one https origin, such as https://<project>.pages.dev",
    ]);
  });

  test("never repeats the value it checked", () => {
    const value = "http://secret-looking-origin.example";

    expect(problemsWithAllowedOrigins(value).join(" ")).not.toContain(value);
  });
});
