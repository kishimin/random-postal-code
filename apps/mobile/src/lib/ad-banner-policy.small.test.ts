import { describe, expect, test } from "vitest";
import {
  bannerRetryDelayMs,
  maxBannerRetries,
  selectBannerUnitId,
} from "./ad-banner-policy";

const testId = "ca-app-pub-3940256099942544/9214589741";
const productionId = "ca-app-pub-1111111111111111/1111111111";

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
