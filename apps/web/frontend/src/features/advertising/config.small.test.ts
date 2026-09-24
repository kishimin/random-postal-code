import { describe, expect, test } from "vitest";
import {
  MAX_AD_SCRIPT_LOAD_ATTEMPTS,
  adScriptRetryDelayMs,
  adsenseScriptUrl,
  hasRemainingAdScriptAttempt,
} from "./config";

describe("adsenseScriptUrl", () => {
  // acceptance/selectors/advertising-selectors.ts's advertisingScriptPattern
  // matches only this host and path; a different host or path would never be
  // recognised as the AdSense loader at all.
  test("builds the AdSense loader URL against the client ID", () => {
    const url = adsenseScriptUrl("ca-pub-1234567890123456");

    expect(url).toMatch(
      /^https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-1234567890123456$/,
    );
  });
});

describe("hasRemainingAdScriptAttempt", () => {
  test("allows another attempt while under the maximum", () => {
    expect(hasRemainingAdScriptAttempt(MAX_AD_SCRIPT_LOAD_ATTEMPTS - 1)).toBe(
      true,
    );
  });

  // design.md section 7: "Ads must not ... retry indefinitely." This is the
  // one place that bound is decided.
  test("refuses a further attempt once the maximum has been reached", () => {
    expect(hasRemainingAdScriptAttempt(MAX_AD_SCRIPT_LOAD_ATTEMPTS)).toBe(
      false,
    );
  });
});

describe("adScriptRetryDelayMs", () => {
  test("grows with the attempt number, so a run of failures backs off", () => {
    const first = adScriptRetryDelayMs(1);
    const second = adScriptRetryDelayMs(2);

    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
  });
});
