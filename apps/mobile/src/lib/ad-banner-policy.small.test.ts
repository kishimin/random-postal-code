import { describe, expect, test } from "vitest";
import {
  bannerRetryDelayMs,
  maxBannerRetries,
  selectBannerUnitId,
  selectPlatformUnitId,
} from "./ad-banner-policy";

const testId = "ca-app-pub-3940256099942544/9214589741";
const productionId = "ca-app-pub-1111111111111111/1111111111";

describe("selectPlatformUnitId", () => {
  // The two IDs differ, so a selection that swapped them would fail.
  const unitIds = {
    android: "ca-app-pub-1111111111111111/3333333333",
    ios: "ca-app-pub-2222222222222222/4444444444",
  };

  test("gives iOS the iOS unit", () => {
    expect(selectPlatformUnitId({ os: "ios", unitIds })).toBe(unitIds.ios);
  });

  test("gives Android the Android unit", () => {
    expect(selectPlatformUnitId({ os: "android", unitIds })).toBe(
      unitIds.android,
    );
  });

  test("gives a platform whose unit is unset no unit", () => {
    expect(
      selectPlatformUnitId({
        os: "ios",
        unitIds: { android: unitIds.android, ios: undefined },
      }),
    ).toBeUndefined();
  });
});

describe("selectBannerUnitId", () => {
  test("uses the test banner in development even when a production unit is configured", () => {
    expect(
      selectBannerUnitId({ development: true, productionId, testId }),
    ).toBe(testId);
  });

  test("uses the configured production unit in a release build", () => {
    expect(
      selectBannerUnitId({ development: false, productionId, testId }),
    ).toBe(productionId);
  });

  // No production unit exists until AdMob is set up, and a release build
  // without one must still not request ads with an unknown unit.
  test("uses the test banner in a release build without a production unit", () => {
    expect(
      selectBannerUnitId({
        development: false,
        productionId: undefined,
        testId,
      }),
    ).toBe(testId);
  });
});

describe("bannerRetryDelayMs", () => {
  test("waits before the first retry, after one failure", () => {
    expect(bannerRetryDelayMs(1)).toBeGreaterThan(0);
  });

  test("stops retrying after the allowed number of retries", () => {
    expect(bannerRetryDelayMs(maxBannerRetries)).toBeGreaterThan(0);
    expect(bannerRetryDelayMs(maxBannerRetries + 1)).toBeUndefined();
  });

  test("does not retry when nothing has failed", () => {
    expect(bannerRetryDelayMs(0)).toBeUndefined();
  });

  test("backs off: each wait is longer than the one before", () => {
    const waits = Array.from(
      { length: maxBannerRetries },
      (_, index) => bannerRetryDelayMs(index + 1) ?? 0,
    );
    // Sorted and without repeats is strictly increasing.
    expect(waits).toEqual([...new Set(waits)].sort((a, b) => a - b));
  });
});
