import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { AdRegion } from "./AdRegion";

// jest.mock factories may only reach variables whose names start with `mock`.
// Every mount of the fake banner is one ad request.
const mockBanner = {
  mounts: 0,
  fail: () => undefined as void,
};

jest.mock("react-native-google-mobile-ads", () => {
  const { useEffect } = require("react");
  return {
    __esModule: true,
    default: () => ({ initialize: async () => [] }),
    AdsConsent: {},
    BannerAd: ({ onAdFailedToLoad }: { onAdFailedToLoad: () => void }) => {
      mockBanner.fail = onAdFailedToLoad;
      useEffect(() => {
        mockBanner.mounts += 1;
      }, []);
      return null;
    },
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER" },
    TestIds: { ADAPTIVE_BANNER: "test-adaptive-banner" },
  };
});

const ready = { status: "ready", nonPersonalizedOnly: false } as const;

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  mockBanner.mounts = 0;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("AdRegion while the privacy options are being changed", () => {
  test("does not request another ad until the change has ended", async () => {
    const view = await render(
      <AdRegion state={ready} revision={0} changingPrivacyOptions={false} />,
    );
    await act(async () => {
      mockBanner.fail();
    });

    await view.rerender(
      <AdRegion state={ready} revision={0} changingPrivacyOptions />,
    );
    await advance(30_000);
    expect(mockBanner.mounts).toBe(1);

    await view.rerender(
      <AdRegion state={ready} revision={0} changingPrivacyOptions={false} />,
    );
    await advance(30_000);
    expect(mockBanner.mounts).toBe(2);
  });

  test("keeps the retries a failing banner has used when the change ends", async () => {
    const view = await render(
      <AdRegion state={ready} revision={0} changingPrivacyOptions={false} />,
    );
    await act(async () => {
      mockBanner.fail();
    });
    await view.rerender(
      <AdRegion state={ready} revision={0} changingPrivacyOptions />,
    );
    await view.rerender(
      <AdRegion state={ready} revision={0} changingPrivacyOptions={false} />,
    );
    await advance(30_000);
    expect(mockBanner.mounts).toBe(2);

    await act(async () => {
      mockBanner.fail();
    });
    await advance(120_000);
    expect(mockBanner.mounts).toBe(3);

    await act(async () => {
      mockBanner.fail();
    });
    await advance(600_000);
    expect(mockBanner.mounts).toBe(3);
  });
});
