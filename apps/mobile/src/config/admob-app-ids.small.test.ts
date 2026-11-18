import { describe, expect, test } from "vitest";
import { googleTestAppIds, resolveAdMobAppIds } from "./admob-app-ids";

describe("googleTestAppIds", () => {
  // Google publishes these so that development builds can start the SDK
  // without an AdMob account.
  test("are the AdMob sample app IDs of each platform", () => {
    expect(googleTestAppIds).toEqual({
      android: "ca-app-pub-3940256099942544~3347511713",
      ios: "ca-app-pub-3940256099942544~1458002511",
    });
  });
});

describe("resolveAdMobAppIds", () => {
  test("keeps the configured app ID of each platform", () => {
    expect(
      resolveAdMobAppIds({
        ADMOB_ANDROID_APP_ID: "ca-app-pub-1111111111111111~1111111111",
        ADMOB_IOS_APP_ID: "ca-app-pub-2222222222222222~2222222222",
      }),
    ).toEqual({
      android: "ca-app-pub-1111111111111111~1111111111",
      ios: "ca-app-pub-2222222222222222~2222222222",
    });
  });

  // An empty value is what a variable listed in .env with nothing after `=`
  // arrives as.
  test.each([undefined, ""])("falls back to the test IDs when %j", (value) => {
    expect(
      resolveAdMobAppIds({
        ADMOB_ANDROID_APP_ID: value,
        ADMOB_IOS_APP_ID: value,
      }),
    ).toEqual(googleTestAppIds);
  });

  test("falls back for one platform without touching the other", () => {
    expect(
      resolveAdMobAppIds({
        ADMOB_ANDROID_APP_ID: "ca-app-pub-1111111111111111~1111111111",
        ADMOB_IOS_APP_ID: "",
      }),
    ).toEqual({
      android: "ca-app-pub-1111111111111111~1111111111",
      ios: googleTestAppIds.ios,
    });
  });
});
