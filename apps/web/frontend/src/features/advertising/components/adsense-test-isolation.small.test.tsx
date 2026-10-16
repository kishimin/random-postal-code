import { describe, expect, test } from "vitest";
import { adsenseScriptUrl } from "../config";

/*
 * Issue #61: in CI, Google's real adsbygoogle.js sometimes reached the test
 * browser while AdvertisingRegion.small.test.tsx ran, then threw TagError
 * against the test DOM and failed unrelated runs. MSW's stand-in loader
 * answers every request it sees, so the real script got in through a
 * request MSW did not see in time. Rather than depend on that timing, the
 * test browser cannot resolve the AdSense host at all (vite.config.ts), so
 * anything that slips past MSW fails instead of loading the real script.
 */
describe("AdSense in tests", () => {
  test("a request to the AdSense host that no handler answers fails instead of reaching Google", async () => {
    // A path on the same host that no MSW handler covers, which is exactly
    // what a request that slips past MSW looks like.
    const unhandled = new URL(
      "/pagead/show_ads.js",
      adsenseScriptUrl("ca-pub-1234567890123456"),
    ).toString();

    await expect(fetch(unhandled, { mode: "no-cors" })).rejects.toThrow();
  });
});
