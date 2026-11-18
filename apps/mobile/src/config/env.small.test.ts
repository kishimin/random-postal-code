import { describe, expect, test } from "vitest";
import { readMobileConfig } from "./env";

const unset = {
  apiBaseUrl: undefined,
  adBannerUnitId: undefined,
  adBannerUnitIdAndroid: undefined,
  adBannerUnitIdIos: undefined,
};

describe("readMobileConfig", () => {
  test("passes the build-time values through", () => {
    expect(
      readMobileConfig({
        ...unset,
        apiBaseUrl: "https://api.example.test",
        adBannerUnitIdAndroid: "ca-app-pub-1111111111111111/1111111111",
        adBannerUnitIdIos: "ca-app-pub-2222222222222222/2222222222",
      }),
    ).toEqual({
      apiBaseUrl: "https://api.example.test",
      adBannerUnitIds: {
        android: "ca-app-pub-1111111111111111/1111111111",
        ios: "ca-app-pub-2222222222222222/2222222222",
      },
    });
  });

  // A variable listed in .env with nothing after `=` arrives as "", which
  // means "not configured", not "configured as the empty string".
  test.each([undefined, ""])("treats %j as unset", (value) => {
    expect(
      readMobileConfig({
        apiBaseUrl: value,
        adBannerUnitId: value,
        adBannerUnitIdAndroid: value,
        adBannerUnitIdIos: value,
      }),
    ).toEqual({
      apiBaseUrl: undefined,
      adBannerUnitIds: { android: undefined, ios: undefined },
    });
  });

  // process.env is untyped under Expo, so anything else that arrived is
  // not trusted as a setting.
  test.each([0, true, {}])("treats a non-string %j as unset", (value) => {
    expect(
      readMobileConfig({
        apiBaseUrl: value,
        adBannerUnitId: value,
        adBannerUnitIdAndroid: value,
        adBannerUnitIdIos: value,
      }),
    ).toEqual({
      apiBaseUrl: undefined,
      adBannerUnitIds: { android: undefined, ios: undefined },
    });
  });

  // Issue #12 named one shared variable before the units were split per
  // platform. It stays as an alias for Android only: an AdMob unit belongs to
  // one app, so it must never be sent to the iOS app.
  describe("the shared unit ID from before the split", () => {
    const shared = "ca-app-pub-3333333333333333/3333333333";

    test("stands in for the Android unit when that is unset", () => {
      expect(
        readMobileConfig({ ...unset, adBannerUnitId: shared }).adBannerUnitIds,
      ).toEqual({ android: shared, ios: undefined });
    });

    test("yields to the Android unit when both are set", () => {
      expect(
        readMobileConfig({
          ...unset,
          adBannerUnitId: shared,
          adBannerUnitIdAndroid: "ca-app-pub-1111111111111111/1111111111",
        }).adBannerUnitIds.android,
      ).toBe("ca-app-pub-1111111111111111/1111111111");
    });
  });
});
