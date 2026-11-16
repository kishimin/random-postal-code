import { describe, expect, test } from "vitest";
import { readMobileConfig } from "./env";

describe("readMobileConfig", () => {
  test("passes the build-time values through", () => {
    expect(
      readMobileConfig({
        apiBaseUrl: "https://api.example.test",
        adBannerUnitId: "ca-app-pub-0000000000000000/0000000000",
      }),
    ).toEqual({
      apiBaseUrl: "https://api.example.test",
      adBannerUnitId: "ca-app-pub-0000000000000000/0000000000",
    });
  });

  // A variable listed in .env with nothing after `=` arrives as "", which
  // means "not configured", not "configured as the empty string".
  test.each([undefined, ""])("treats %j as unset", (value) => {
    expect(
      readMobileConfig({ apiBaseUrl: value, adBannerUnitId: value }),
    ).toEqual({ apiBaseUrl: undefined, adBannerUnitId: undefined });
  });
});
