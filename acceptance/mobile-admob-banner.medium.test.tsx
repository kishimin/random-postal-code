import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as rntl from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import path from "node:path";
import * as rn from "react-native";

/*
 * Acceptance test for Issue #15: AdMob banner ads and consent on Android and
 * iOS, the part about what the running app does. What is built (identifiers
 * per platform, permissions, the bundle, `expo export --platform ios`) is
 * mobile-admob-banner-bundle.medium.test.ts, which also checks that this file
 * runs under both platform projects.
 *
 * Each test name starts with the criterion it holds (AC-1 … AC-11, in the
 * Issue's order).
 *
 * How the app is exercised
 * ------------------------
 * As in Issues #13 and #14, the app's own route directory is rendered through
 * Expo Router's testing library, once with the jest-expo iOS preset and once
 * with the Android preset (ADR-0082). Every test is a fresh launch: the routes
 * are rendered anew, from the root layout down, and the previous render is
 * unmounted. The consent and ad start-up therefore belongs to a mounted app,
 * not to a module loaded once for the whole file, so that each launch asks
 * the SDKs again, as starting the app on a device does.
 *
 * The owner chose `react-native-google-mobile-ads` (UMP through its built-in
 * `AdsConsent`) and `expo-tracking-transparency` (ATT) on Issue #15 (option
 * A, 2026-11-18). Both are native modules that do not exist under Jest, so
 * both are replaced at the package boundary by the fakes below, the way
 * `fetch` is replaced for the Zipnami API. The fakes keep the libraries'
 * exported names and value shapes, and they record what the app asked for:
 *
 * - An ad request is a mounted `BannerAd` or a call to its `load()`. Each is
 *   recorded with the unit ID, the request options, and whether the consent
 *   flow and the ATT prompt had finished at that moment.
 * - The consent flow is `AdsConsent.gatherConsent()`, or the two-step
 *   `requestInfoUpdate()` and `loadAndShowConsentFormIfRequired()`. Either
 *   path may be used; both can be held open and both end with the outcome the
 *   test chose. `getUserChoices()` reports what the person allowed.
 * - The ATT prompt is `requestTrackingPermissionsAsync()`, which can be held
 *   open until the test answers it.
 * - Every full-screen format (interstitial, rewarded, app open) and the native
 *   format record their use, which must never happen.
 *
 * Which unit ID a run uses
 * ------------------------
 * The per-platform production banner unit IDs are set in the environment, as
 * a misconfigured developer machine or CI might have them, together with the
 * older shared variable from Issue #12. A Jest run is an automated check, so
 * every request must still use Google's test banner for the platform.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - Where on the screen the banner sits, its size, and its colours. Layout is
 *   verified visually. That it stays inside the 「広告」 region and that the
 *   region holds no app control is pinned instead.
 * - Whether ads are personalised when everything is allowed. The criteria ask
 *   only that a refusal falls back to non-personalised or limited ads.
 * - The consent form's own screens and the ATT dialog's wording, which the
 *   SDKs draw. That they are shown on a device is not checked: no device runs
 *   in CI, and docs/design.md section 6.3 rules out an iOS device check.
 * - How many times a failed request may be repeated, only that it stops.
 */

const apiBaseUrl = "https://api.zipnami-acceptance.example";
process.env.EXPO_PUBLIC_API_BASE_URL = apiBaseUrl;

// Production-shaped placeholders on a publisher ID no one owns. A development
// or test run must ignore them.
const productionUnitIds = {
  android: "ca-app-pub-1111111111111111/1111111111",
  ios: "ca-app-pub-2222222222222222/2222222222",
  shared: "ca-app-pub-3333333333333333/3333333333",
};
process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID = productionUnitIds.android;
process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS = productionUnitIds.ios;
process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID = productionUnitIds.shared;

/** Google's published test banner unit IDs, per platform. */
const googleTestBannerIds = {
  android: [
    "ca-app-pub-3940256099942544/6300978111",
    "ca-app-pub-3940256099942544/9214589741",
  ],
  ios: [
    "ca-app-pub-3940256099942544/2934735716",
    "ca-app-pub-3940256099942544/2435281174",
  ],
} as const;

const appDirectory = path.resolve(
  __dirname,
  "..",
  "apps",
  "mobile",
  "src",
  "app",
);

const startLabel = "ランダム生成する";
const currentResultLabel = "今回の結果";
const historyLabel = "生成の履歴";
const adRegionLabel = "広告";
const bannerTestId = "fake-admob-banner";
const tokyoMapLink = "東京都千代田区千代田をGoogle マップで開く";

type ConsentStatus = "UNKNOWN" | "REQUIRED" | "NOT_REQUIRED" | "OBTAINED";
type ConsentInfo = {
  status: ConsentStatus;
  canRequestAds: boolean;
  isConsentFormAvailable: boolean;
  privacyOptionsRequirementStatus: "UNKNOWN" | "REQUIRED" | "NOT_REQUIRED";
};
type TrackingAnswer = "granted" | "denied";
type AdRequest = {
  unitId: unknown;
  requestOptions: Record<string, unknown> | undefined;
  consentFinished: boolean;
  trackingAnswered: boolean;
};

const consentGiven: ConsentInfo = {
  status: "OBTAINED",
  canRequestAds: true,
  isConsentFormAvailable: true,
  privacyOptionsRequirementStatus: "REQUIRED",
};

// The person is in a region that requires consent and closed the form
// without giving it: the SDK says ads cannot be requested.
const consentWithheld: ConsentInfo = {
  status: "REQUIRED",
  canRequestAds: false,
  isConsentFormAvailable: true,
  privacyOptionsRequirementStatus: "REQUIRED",
};

/**
 * Every purpose the UMP form lists, set to one answer.
 * @param allowed - What the person chose for all of them.
 * @returns The choices as `AdsConsent.getUserChoices()` reports them.
 */
const userChoices = (allowed: boolean): Record<string, boolean> => ({
  activelyScanDeviceCharacteristicsForIdentification: allowed,
  applyMarketResearchToGenerateAudienceInsights: allowed,
  createAPersonalisedAdsProfile: allowed,
  createAPersonalisedContentProfile: allowed,
  developAndImproveProducts: allowed,
  measureAdPerformance: allowed,
  measureContentPerformance: allowed,
  selectBasicAds: allowed,
  selectPersonalisedAds: allowed,
  selectPersonalisedContent: allowed,
  storeAndAccessInformationOnDevice: allowed,
  understandAudiencesThroughStatisticsOrCombinationsWithOtherDataSources:
    allowed,
  usePreciseGeolocationData: allowed,
});

/** A gate the test opens when it chooses. */
type Gate = { opened: Promise<void>; open: () => void };
const gate = (): Gate => {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((done) => {
    open = done;
  });
  return { opened, open };
};
const openGate = (): Gate => ({
  opened: Promise.resolve(),
  open: () => undefined,
});

/**
 * What the fake SDKs answer and what they saw. jest.mock factories may only
 * reach variables whose names start with `mock`.
 */
const mockSdk = {
  consent: consentGiven as ConsentInfo | Error,
  consentGate: openGate(),
  consentFinished: false,
  settledConsent: undefined as ConsentInfo | undefined,
  choices: userChoices(true),
  tracking: "granted" as TrackingAnswer | Error,
  trackingGate: openGate(),
  trackingAsked: 0,
  trackingAnswered: false,
  advertisingId: "6D92078A-8246-4BA4-AE5B-76104861E7DC",
  initializeFails: false,
  bannerFails: false,
  requests: [] as AdRequest[],
  otherFormats: [] as string[],
  reset(): void {
    this.consent = consentGiven;
    this.consentGate = openGate();
    this.consentFinished = false;
    this.settledConsent = undefined;
    this.choices = userChoices(true);
    this.tracking = "granted";
    this.trackingGate = openGate();
    this.trackingAsked = 0;
    this.trackingAnswered = false;
    this.initializeFails = false;
    this.bannerFails = false;
    this.requests = [];
    this.otherFormats = [];
  },
};

jest.mock(
  "react-native-google-mobile-ads",
  () => {
    // jest.mock factories are hoisted above the imports, so they require.
    const React: typeof import("react") = require("react");
    const {
      Platform,
      View,
    }: typeof import("react-native") = require("react-native");

    const beforeForm = (final: ConsentInfo): ConsentInfo =>
      final.status === "OBTAINED"
        ? { ...final, status: "REQUIRED", canRequestAds: false }
        : final;

    const finish = (final: ConsentInfo): ConsentInfo => {
      mockSdk.settledConsent = final;
      mockSdk.consentFinished = true;
      return final;
    };

    const outcome = (): ConsentInfo => {
      if (mockSdk.consent instanceof Error) throw mockSdk.consent;
      return mockSdk.consent;
    };

    const AdsConsent = {
      gatherConsent: async (): Promise<ConsentInfo> => {
        await mockSdk.consentGate.opened;
        return finish(outcome());
      },
      requestInfoUpdate: async (): Promise<ConsentInfo> => {
        await mockSdk.consentGate.opened;
        const info = beforeForm(outcome());
        if (info.status !== "REQUIRED") finish(info);
        return info;
      },
      loadAndShowConsentFormIfRequired: async (): Promise<ConsentInfo> =>
        finish(outcome()),
      showForm: async (): Promise<ConsentInfo> => finish(outcome()),
      showPrivacyOptionsForm: async (): Promise<ConsentInfo> =>
        finish(outcome()),
      getConsentInfo: async (): Promise<ConsentInfo> =>
        mockSdk.settledConsent ??
        (mockSdk.consent instanceof Error
          ? consentWithheld
          : beforeForm(mockSdk.consent)),
      getUserChoices: async () => mockSdk.choices,
      getGdprApplies: async () => true,
      getPurposeConsents: async () => "",
      getPurposeLegitimateInterests: async () => "",
      getTCString: async () => "",
      reset: () => undefined,
    };

    const request = (props: Record<string, unknown>): void => {
      mockSdk.requests.push({
        unitId: props.unitId,
        requestOptions: props.requestOptions as
          Record<string, unknown> | undefined,
        consentFinished: mockSdk.consentFinished,
        trackingAnswered: mockSdk.trackingAnswered,
      });
      const fails = mockSdk.bannerFails;
      void Promise.resolve().then(() => {
        const callback = fails ? props.onAdFailedToLoad : props.onAdLoaded;
        if (typeof callback === "function") {
          callback(
            fails
              ? Object.assign(new Error("No ad to show."), {
                  code: "googleMobileAds/error-code-no-fill",
                })
              : { width: 320, height: 50 },
          );
        }
      });
    };

    const BannerAd = React.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        React.useImperativeHandle(ref, () => ({
          load: () => {
            request(props);
          },
        }));
        // One mount is one request; a changed key is a new mount. The props
        // of that first render are the ones the request was made with.
        React.useEffect(() => {
          request(props);
        }, []);
        return React.createElement(View, { testID: "fake-admob-banner" });
      },
    );

    const forbidden = (name: string) => ({
      createForAdRequest: () => {
        mockSdk.otherFormats.push(name);
        return {
          load: () => undefined,
          show: async () => undefined,
          addAdEventListener: () => () => undefined,
          addAdEventsListener: () => () => undefined,
          removeAllListeners: () => undefined,
          loaded: false,
        };
      },
    });
    const forbiddenHook = (name: string) => () => {
      mockSdk.otherFormats.push(name);
      return { isLoaded: false, load: () => undefined, show: () => undefined };
    };

    const instance = {
      initialize: async () => {
        if (mockSdk.initializeFails) {
          throw new Error("Mobile Ads SDK failed to start.");
        }
        return [];
      },
      setRequestConfiguration: async () => undefined,
      openAdInspector: async () => undefined,
      openDebugMenu: () => undefined,
      setAppVolume: () => undefined,
      setAppMuted: () => undefined,
    };

    const platformIds = (ios: string, android: string): string =>
      Platform.OS === "ios" ? ios : android;

    return {
      __esModule: true,
      default: () => instance,
      mobileAds: () => instance,
      AdsConsent,
      AdsConsentStatus: {
        UNKNOWN: "UNKNOWN",
        REQUIRED: "REQUIRED",
        NOT_REQUIRED: "NOT_REQUIRED",
        OBTAINED: "OBTAINED",
      },
      AdsConsentPrivacyOptionsRequirementStatus: {
        UNKNOWN: "UNKNOWN",
        REQUIRED: "REQUIRED",
        NOT_REQUIRED: "NOT_REQUIRED",
      },
      AdsConsentDebugGeography: {
        DISABLED: 0,
        EEA: 1,
        NOT_EEA: 2,
        REGULATED_US_STATE: 3,
        OTHER: 4,
      },
      MaxAdContentRating: { G: "G", PG: "PG", T: "T", MA: "MA" },
      BannerAd,
      BannerAdSize: {
        BANNER: "BANNER",
        FULL_BANNER: "FULL_BANNER",
        LARGE_BANNER: "LARGE_BANNER",
        LEADERBOARD: "LEADERBOARD",
        MEDIUM_RECTANGLE: "MEDIUM_RECTANGLE",
        ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER",
        INLINE_ADAPTIVE_BANNER: "INLINE_ADAPTIVE_BANNER",
        WIDE_SKYSCRAPER: "WIDE_SKYSCRAPER",
        FLUID: "FLUID",
      },
      TestIds: {
        BANNER: platformIds(
          "ca-app-pub-3940256099942544/2934735716",
          "ca-app-pub-3940256099942544/6300978111",
        ),
        ADAPTIVE_BANNER: platformIds(
          "ca-app-pub-3940256099942544/2435281174",
          "ca-app-pub-3940256099942544/9214589741",
        ),
        APP_OPEN: "test-app-open",
        INTERSTITIAL: "test-interstitial",
        REWARDED: "test-rewarded",
        REWARDED_INTERSTITIAL: "test-rewarded-interstitial",
        NATIVE: "test-native",
      },
      AdEventType: {
        LOADED: "loaded",
        ERROR: "error",
        OPENED: "opened",
        CLICKED: "clicked",
        CLOSED: "closed",
      },
      useForeground: () => undefined,
      InterstitialAd: forbidden("InterstitialAd"),
      RewardedAd: forbidden("RewardedAd"),
      RewardedInterstitialAd: forbidden("RewardedInterstitialAd"),
      AppOpenAd: forbidden("AppOpenAd"),
      NativeAd: forbidden("NativeAd"),
      useInterstitialAd: forbiddenHook("useInterstitialAd"),
      useRewardedAd: forbiddenHook("useRewardedAd"),
      useRewardedInterstitialAd: forbiddenHook("useRewardedInterstitialAd"),
      useAppOpenAd: forbiddenHook("useAppOpenAd"),
    };
  },
  { virtual: true },
);

jest.mock(
  "expo-tracking-transparency",
  () => {
    const permission = (status: "granted" | "denied" | "undetermined") => ({
      status,
      granted: status === "granted",
      canAskAgain: status === "undetermined",
      expires: "never",
    });
    const answered = () =>
      mockSdk.tracking instanceof Error || !mockSdk.trackingAnswered
        ? permission("undetermined")
        : permission(mockSdk.tracking);
    return {
      __esModule: true,
      PermissionStatus: {
        GRANTED: "granted",
        DENIED: "denied",
        UNDETERMINED: "undetermined",
      },
      isAvailable: () => true,
      getTrackingPermissionsAsync: async () => answered(),
      requestTrackingPermissionsAsync: async () => {
        mockSdk.trackingAsked += 1;
        await mockSdk.trackingGate.opened;
        if (mockSdk.tracking instanceof Error) throw mockSdk.tracking;
        mockSdk.trackingAnswered = true;
        return permission(mockSdk.tracking);
      },
      useTrackingPermissions: () => [
        answered(),
        async () => answered(),
        async () => answered(),
      ],
      getAdvertisingId: () => mockSdk.advertisingId,
    };
  },
  { virtual: true },
);

const platform: "ios" | "android" =
  rn.Platform.OS === "ios" ? "ios" : "android";

const respond = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const tokyo = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

/**
 * A fetch that answers every call with Tokyo, as the Zipnami API would.
 * @returns The installed mock.
 */
const answerWithTokyo = (): jest.Mock<typeof fetch> => {
  const mock = jest.fn<typeof fetch>(() =>
    Promise.resolve(respond(200, tokyo)),
  );
  globalThis.fetch = mock;
  return mock;
};

/** Starts the app, as a person opening it does. */
const launch = async (): Promise<void> => {
  jest.mocked(rn.Linking.openURL).mockResolvedValue(true);
  jest.mocked(rn.Linking.canOpenURL).mockResolvedValue(true);
  await renderRouter(appDirectory, { initialUrl: "/" });
};

/** Lets pending promise callbacks, such as an SDK answer, run. */
const settle = async (): Promise<void> => {
  // Timers are not used to wait: Expo Router's testing library may install
  // fake ones, and a timer would never fire.
  await rntl.act(async () => {
    for (let turn = 0; turn < 50; turn += 1) await Promise.resolve();
  });
};

const adRegion = () => rntl.within(rntl.screen.getByLabelText(adRegionLabel));

const waitForBanner = async (): Promise<void> => {
  await rntl.waitFor(() => {
    expect(adRegion().getByTestId(bannerTestId)).toBeTruthy();
  });
  expect(mockSdk.requests.length).toBeGreaterThan(0);
};

/**
 * Generates a postal code, finds it in the result and the history, and opens
 * its address in the map: every core feature of the start screen.
 * @returns The fetch mock that answered the generation.
 */
const expectCoreFeaturesUsable = async (): Promise<jest.Mock<typeof fetch>> => {
  const { screen, fireEvent, waitFor, within } = rntl;
  const fetchMock = answerWithTokyo();

  await fireEvent.press(screen.getByRole("button", { name: startLabel }));

  await waitFor(() => {
    expect(
      within(screen.getByLabelText(currentResultLabel)).getByText("〒100-0001"),
    ).toBeTruthy();
  });
  await waitFor(() => {
    expect(
      within(screen.getByLabelText(historyLabel)).getAllByText("〒100-0001"),
    ).not.toHaveLength(0);
  });

  await fireEvent.press(
    within(screen.getByLabelText(currentResultLabel)).getByRole("link", {
      name: tokyoMapLink,
    }),
  );
  await waitFor(() => {
    expect(rn.Linking.openURL).toHaveBeenCalledTimes(1);
  });
  expect(String(jest.mocked(rn.Linking.openURL).mock.calls[0]?.[0])).toContain(
    "https://www.google.com/maps/search/",
  );
  return fetchMock;
};

const nonPersonalised = (request: AdRequest): boolean =>
  request.requestOptions?.requestNonPersonalizedAdsOnly === true;

const originalFetch = globalThis.fetch;
const iosOnly = platform === "ios" ? test : test.skip;

beforeEach(async () => {
  mockSdk.reset();
  // A fresh device: no history from an earlier test is shown.
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
  // AC-1, in every scenario: no format other than the banner is ever used.
  expect(mockSdk.otherFormats).toEqual([]);
});

describe(`Issue #15 on ${platform}: AdMob banner ads and consent`, () => {
  test("AC-1 the only ad is one banner, shown in the 「広告」 region", async () => {
    await launch();

    await waitForBanner();

    expect(rntl.screen.getAllByTestId(bannerTestId)).toHaveLength(1);
    expect(mockSdk.otherFormats).toEqual([]);
  });

  test("AC-2 the ad region holds no app control, and every core feature works while the banner is shown", async () => {
    await launch();
    await waitForBanner();

    const region = adRegion();
    expect(region.queryAllByRole("button")).toEqual([]);
    expect(region.queryAllByRole("link")).toEqual([]);
    expect(region.queryByText(startLabel)).toBeNull();
    expect(region.queryByText(/〒/)).toBeNull();

    await expectCoreFeaturesUsable();

    expect(adRegion().getByTestId(bannerTestId)).toBeTruthy();
    expect(rntl.screen.getAllByTestId(bannerTestId)).toHaveLength(1);
  });

  test("AC-3 an automated run requests Google's test banner even when production unit IDs are configured", async () => {
    await launch();
    await waitForBanner();

    const unitIds = mockSdk.requests.map((request) => request.unitId);
    for (const unitId of unitIds) {
      expect(googleTestBannerIds[platform]).toContain(unitId);
    }
    expect(unitIds).not.toContain(productionUnitIds.android);
    expect(unitIds).not.toContain(productionUnitIds.ios);
    expect(unitIds).not.toContain(productionUnitIds.shared);
  });

  test("AC-4 the test banner requested is the one for this platform", async () => {
    await launch();
    await waitForBanner();

    const other = platform === "ios" ? "android" : "ios";
    for (const request of mockSdk.requests) {
      expect(googleTestBannerIds[other]).not.toContain(request.unitId);
    }
  });

  test("AC-5 no ad is requested before the consent flow ends, and the banner follows once consent is given", async () => {
    const consent = gate();
    mockSdk.consentGate = consent;
    await launch();
    await settle();

    expect(mockSdk.requests).toEqual([]);
    // Waiting for consent never holds up the app itself.
    await expectCoreFeaturesUsable();
    expect(mockSdk.requests).toEqual([]);

    consent.open();
    await waitForBanner();
    for (const request of mockSdk.requests) {
      expect(request.consentFinished).toBe(true);
    }
  });

  test("AC-5 when consent is required and not given, no ad is requested and every core feature works", async () => {
    mockSdk.consent = consentWithheld;
    await launch();
    await settle();

    await expectCoreFeaturesUsable();
    await settle();

    expect(mockSdk.requests).toEqual([]);
    expect(rntl.screen.queryByTestId(bannerTestId)).toBeNull();
  });

  test("AC-6 declined personalisation requests non-personalised ads only", async () => {
    mockSdk.choices = userChoices(false);
    await launch();
    await waitForBanner();

    for (const request of mockSdk.requests) {
      expect(nonPersonalised(request)).toBe(true);
    }
  });

  iosOnly(
    "AC-7 on iOS, no ad is requested until the App Tracking Transparency prompt is answered",
    async () => {
      const tracking = gate();
      mockSdk.trackingGate = tracking;
      await launch();
      await settle();

      expect(mockSdk.trackingAsked).toBeGreaterThan(0);
      expect(mockSdk.requests).toEqual([]);

      tracking.open();
      await waitForBanner();
      for (const request of mockSdk.requests) {
        expect(request.trackingAnswered).toBe(true);
      }
    },
  );

  iosOnly(
    "AC-7 on iOS, denying tracking leaves non-personalised ads and every core feature usable",
    async () => {
      mockSdk.tracking = "denied";
      await launch();
      await waitForBanner();

      for (const request of mockSdk.requests) {
        expect(nonPersonalised(request)).toBe(true);
      }
      await expectCoreFeaturesUsable();
    },
  );

  const failures: Array<{ kind: string; arrange: () => void }> = [
    {
      kind: "the consent flow failing",
      arrange: () => {
        mockSdk.consent = new Error("Consent information is unavailable.");
      },
    },
    {
      kind: "the Mobile Ads SDK failing to start",
      arrange: () => {
        mockSdk.initializeFails = true;
      },
    },
    {
      kind: "the tracking prompt failing",
      arrange: () => {
        mockSdk.tracking = new Error("Tracking permission is unavailable.");
      },
    },
    {
      kind: "the banner failing to load",
      arrange: () => {
        mockSdk.bannerFails = true;
      },
    },
  ];

  test.each(failures)(
    "AC-8 after $kind, every core feature works",
    async ({ arrange }) => {
      arrange();
      await launch();
      await settle();

      await expectCoreFeaturesUsable();
    },
  );

  test("AC-9 a banner that keeps failing is not requested again and again", async () => {
    jest.useFakeTimers();
    mockSdk.bannerFails = true;
    await launch();

    const passHour = async (): Promise<void> => {
      for (let minute = 0; minute < 60; minute += 1) {
        await rntl.act(async () => {
          jest.advanceTimersByTime(60_000);
        });
        await settle();
      }
    };

    await passHour();
    const afterOneHour = mockSdk.requests.length;
    await passHour();

    expect(afterOneHour).toBeGreaterThan(0);
    expect(afterOneHour).toBeLessThanOrEqual(5);
    expect(mockSdk.requests.length).toBe(afterOneHour);
  });

  test("AC-11 no advertising identifier reaches the Zipnami API", async () => {
    await launch();
    await waitForBanner();

    const fetchMock = await expectCoreFeaturesUsable();
    expect(fetchMock).toHaveBeenCalled();

    for (const [input, init] of fetchMock.mock.calls) {
      const request = input instanceof Request ? input : undefined;
      const headers = [
        ...new Headers(init?.headers ?? request?.headers).entries(),
      ];
      const sent = JSON.stringify({
        url: request === undefined ? String(input) : request.url,
        headers,
        body: init?.body ?? null,
      });
      expect(sent.toLowerCase()).not.toContain(
        mockSdk.advertisingId.toLowerCase(),
      );
      for (const [name] of headers) {
        expect(name).not.toMatch(/advertis|idfa|gaid|adid|ad-id/i);
      }
    }
  });
});
