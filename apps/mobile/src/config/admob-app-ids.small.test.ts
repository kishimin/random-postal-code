import { describe, expect, test } from "vitest";
import {
  assertProductionAdMobEnv,
  googleTestAppIds,
  resolveAdMobAppIds,
} from "./admob-app-ids";

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

const completeProductionEnv = {
  ADMOB_ANDROID_APP_ID: "ca-app-pub-1111111111111111~1111111111",
  ADMOB_IOS_APP_ID: "ca-app-pub-2222222222222222~2222222222",
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID:
    "ca-app-pub-1111111111111111/3333333333",
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS: "ca-app-pub-2222222222222222/4444444444",
};

describe("assertProductionAdMobEnv", () => {
  test("accepts a production environment with all four IDs", () => {
    expect(() => {
      assertProductionAdMobEnv(completeProductionEnv);
    }).not.toThrow();
  });

  // A production build that fell back to Google's test IDs would ship with no
  // revenue and nobody noticing, so it must fail while it is built.
  describe.each(Object.keys(completeProductionEnv))("when %s is", (name) => {
    test.each([undefined, ""])("%j, it fails naming the variable", (value) => {
      expect(() => {
        assertProductionAdMobEnv({ ...completeProductionEnv, [name]: value });
      }).toThrow(name);
    });
  });
});
