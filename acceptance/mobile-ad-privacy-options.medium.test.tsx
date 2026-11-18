import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as rntl from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import path from "node:path";
import * as rn from "react-native";

/*
 * Acceptance test for Issue #146: letting a person change their ad consent
 * later from the Android and iOS app. It follows Issue #15, whose consent and
 * banner behaviour mobile-admob-banner.medium.test.tsx pins.
 *
 * Each test name starts with the criterion it holds (AC-1 … AC-4, in the
 * Issue's order).
 *
 * How the app is exercised
 * ------------------------
 * As in Issue #15, the app's own route directory is rendered through Expo
 * Router's testing library, once with the jest-expo iOS preset and once with
 * the Android preset (ADR-0082). Every test is a fresh launch.
 *
 * `react-native-google-mobile-ads` and `expo-tracking-transparency` are
 * native modules that do not exist under Jest, so both are replaced at the
 * package boundary by the fakes below, which keep the libraries' exported
 * names and value shapes:
 *
 * - The consent flow (`gatherConsent()`, or `requestInfoUpdate()` and
 *   `loadAndShowConsentFormIfRequired()`) ends with the consent information
 *   the test chose, which includes the privacy-options requirement.
 *   `getConsentInfo()` reports that information once the flow has ended and
 *   an unknown state before it.
 * - The privacy-options form is `AdsConsent.showPrivacyOptionsForm()`. Each
 *   opening is counted. When it closes, the person's choices
 *   (`getUserChoices()`) and the consent information become what the test
 *   chose for the form, or the call fails as the test chose.
 * - An ad request is a mounted `BannerAd` or a call to its `load()`. Each is
 *   recorded with its request options and how many times the form had closed
 *   by then, so the requests made after the form closed can be told apart.
 *
 * The entry point is found the way a person finds it: a button named
 * 「広告のプライバシー設定」 on the start screen, the screen that shows the
 * banner. It sits outside the 「広告」 region, which Issue #15 keeps free of
 * app controls.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - Where on the start screen the entry point sits, its size, and its
 *   colours. Layout is verified visually.
 * - The form's own screens, which the SDK draws.
 * - What happens to a banner already on screen when the form closes, other
 *   than that no further ad is requested once consent is withdrawn.
 */

const apiBaseUrl = "https://api.zipnami-acceptance.example";
process.env.EXPO_PUBLIC_API_BASE_URL = apiBaseUrl;

const appDirectory = path.resolve(
  __dirname,
  "..",
  "apps",
  "mobile",
  "src",
  "app",
);

const privacyOptionsLabel = "広告のプライバシー設定";
const startLabel = "ランダム生成する";
const currentResultLabel = "今回の結果";
const historyLabel = "生成の履歴";
const adRegionLabel = "広告";
const bannerTestId = "fake-admob-banner";
const tokyoMapLink = "東京都千代田区千代田をGoogle マップで開く";

type ConsentStatus = "UNKNOWN" | "REQUIRED" | "NOT_REQUIRED" | "OBTAINED";
type PrivacyOptionsRequirement = "UNKNOWN" | "REQUIRED" | "NOT_REQUIRED";
type ConsentInfo = {
  status: ConsentStatus;
  canRequestAds: boolean;
  isConsentFormAvailable: boolean;
  privacyOptionsRequirementStatus: PrivacyOptionsRequirement;
};
type Choices = Record<string, boolean>;
type FormOutcome = { consent: ConsentInfo; choices: Choices };
type AdRequest = {
  requestOptions: Record<string, unknown> | undefined;
  formsClosedBefore: number;
};

// Consent given in a region that requires it: the form can be reopened.
const consentGiven: ConsentInfo = {
  status: "OBTAINED",
  canRequestAds: true,
  isConsentFormAvailable: true,
  privacyOptionsRequirementStatus: "REQUIRED",
};

// Consent required and not given: ads cannot be requested, and the person can
// still reopen the form to give it.
const consentWithheld: ConsentInfo = {
  status: "REQUIRED",
  canRequestAds: false,
  isConsentFormAvailable: true,
  privacyOptionsRequirementStatus: "REQUIRED",
};

// A region where no consent is needed and no privacy options are offered.
const consentNotRequired: ConsentInfo = {
  status: "NOT_REQUIRED",
  canRequestAds: true,
  isConsentFormAvailable: false,
  privacyOptionsRequirementStatus: "NOT_REQUIRED",
};

// Consent given, but the SDK could not tell whether privacy options apply.
const requirementUnknown: ConsentInfo = {
  ...consentGiven,
  privacyOptionsRequirementStatus: "UNKNOWN",
};

// What the SDK reports before the consent flow has ended.
const unknownConsent: ConsentInfo = {
  status: "UNKNOWN",
  canRequestAds: false,
  isConsentFormAvailable: false,
  privacyOptionsRequirementStatus: "UNKNOWN",
};

/**
 * Every purpose the UMP form lists, set to one answer.
 * @param allowed - What the person chose for all of them.
 * @returns The choices as `AdsConsent.getUserChoices()` reports them.
 */
const userChoices = (allowed: boolean): Choices => ({
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
  settledConsent: undefined as ConsentInfo | undefined,
  choices: userChoices(true),
  form: { consent: consentGiven, choices: userChoices(true) } as
    FormOutcome | Error,
  formsOpened: 0,
  formsClosed: 0,
  requests: [] as AdRequest[],
  reset(): void {
    this.consent = consentGiven;
    this.consentGate = openGate();
    this.settledConsent = undefined;
    this.choices = userChoices(true);
    this.form = { consent: consentGiven, choices: userChoices(true) };
    this.formsOpened = 0;
    this.formsClosed = 0;
    this.requests = [];
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

    const finish = (final: ConsentInfo): ConsentInfo => {
      mockSdk.settledConsent = final;
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
        const info = outcome();
        if (info.status !== "OBTAINED") return finish(info);
        return { ...info, status: "REQUIRED", canRequestAds: false };
      },
      loadAndShowConsentFormIfRequired: async (): Promise<ConsentInfo> =>
        finish(outcome()),
      showForm: async (): Promise<ConsentInfo> => finish(outcome()),
      showPrivacyOptionsForm: async (): Promise<ConsentInfo> => {
        mockSdk.formsOpened += 1;
        await Promise.resolve();
        if (mockSdk.form instanceof Error) throw mockSdk.form;
        mockSdk.choices = mockSdk.form.choices;
        mockSdk.formsClosed += 1;
        return finish(mockSdk.form.consent);
      },
      getConsentInfo: async (): Promise<ConsentInfo> =>
        mockSdk.settledConsent ?? unknownConsent,
      getUserChoices: async () => mockSdk.choices,
      getGdprApplies: async () => true,
      getPurposeConsents: async () => "",
      getPurposeLegitimateInterests: async () => "",
      getTCString: async () => "",
      reset: () => undefined,
    };

    const request = (props: Record<string, unknown>): void => {
      mockSdk.requests.push({
        requestOptions: props.requestOptions as
          Record<string, unknown> | undefined,
        formsClosedBefore: mockSdk.formsClosed,
      });
      void Promise.resolve().then(() => {
        if (typeof props.onAdLoaded === "function") {
          props.onAdLoaded({ width: 320, height: 50 });
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

    const instance = {
      initialize: async () => [],
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
      },
      AdEventType: {
        LOADED: "loaded",
        ERROR: "error",
        OPENED: "opened",
        CLICKED: "clicked",
        CLOSED: "closed",
      },
      useForeground: () => undefined,
    };
  },
  { virtual: true },
);

// Tracking is allowed throughout, so on iOS only the consent choices decide
// whether an ad may be personalised.
jest.mock(
  "expo-tracking-transparency",
  () => {
    const granted = {
      status: "granted",
      granted: true,
      canAskAgain: false,
      expires: "never",
    };
    return {
      __esModule: true,
      PermissionStatus: {
        GRANTED: "granted",
        DENIED: "denied",
        UNDETERMINED: "undetermined",
      },
      isAvailable: () => true,
      getTrackingPermissionsAsync: async () => granted,
      requestTrackingPermissionsAsync: async () => granted,
      useTrackingPermissions: () => [
        granted,
        async () => granted,
        async () => granted,
      ],
      getAdvertisingId: () => null,
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

const queryEntryPoint = () =>
  rntl.screen.queryByRole("button", { name: privacyOptionsLabel });

const findEntryPoint = async () =>
  rntl.screen.findByRole("button", { name: privacyOptionsLabel });

const waitForBanner = async (): Promise<void> => {
  await rntl.waitFor(() => {
    expect(adRegion().getByTestId(bannerTestId)).toBeTruthy();
  });
  expect(mockSdk.requests.length).toBeGreaterThan(0);
};

/** Opens the privacy-options form from the entry point, and lets it close. */
const changeConsentThroughForm = async (): Promise<void> => {
  await rntl.fireEvent.press(await findEntryPoint());
  await settle();
};

const requestsAfterForm = (): AdRequest[] =>
  mockSdk.requests.filter((request) => request.formsClosedBefore > 0);

const waitForRequestAfterForm = async (): Promise<AdRequest[]> => {
  await rntl.waitFor(() => {
    expect(requestsAfterForm().length).toBeGreaterThan(0);
  });
  return requestsAfterForm();
};

const nonPersonalised = (request: AdRequest): boolean =>
  request.requestOptions?.requestNonPersonalizedAdsOnly === true;

/**
 * Generates a postal code, finds it in the result and the history, and opens
 * its address in the map: every core feature of the start screen.
 */
const expectCoreFeaturesUsable = async (): Promise<void> => {
  const { screen, fireEvent, waitFor, within } = rntl;
  globalThis.fetch = jest.fn<typeof fetch>(() =>
    Promise.resolve(respond(200, tokyo)),
  );

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
};

const originalFetch = globalThis.fetch;

beforeEach(async () => {
  mockSdk.reset();
  globalThis.fetch = originalFetch;
  // A fresh device: no history from an earlier test is shown.
  await AsyncStorage.clear();
});

describe(`Issue #146 on ${platform}: changing ad consent later`, () => {
  test.each([
    { kind: "consent was given", consent: consentGiven },
    { kind: "consent was withheld", consent: consentWithheld },
  ])(
    "AC-1 when privacy options are REQUIRED and $kind, an entry point outside the ad region opens the privacy-options form",
    async ({ consent }) => {
      mockSdk.consent = consent;
      await launch();

      const entryPoint = await findEntryPoint();
      expect(entryPoint).toBeTruthy();
      expect(adRegion().queryAllByRole("button")).toEqual([]);
      expect(mockSdk.formsOpened).toBe(0);

      await rntl.fireEvent.press(entryPoint);
      await settle();

      expect(mockSdk.formsOpened).toBe(1);
    },
  );

  test("AC-2 no entry point is shown while the requirement is unknown because the consent flow has not ended, and it appears once the SDK reports REQUIRED", async () => {
    const consentFlow = gate();
    mockSdk.consentGate = consentFlow;
    await launch();
    await settle();

    expect(queryEntryPoint()).toBeNull();

    consentFlow.open();
    expect(await findEntryPoint()).toBeTruthy();
  });

  test.each([
    {
      kind: "the requirement is NOT_REQUIRED",
      consent: consentNotRequired,
      bannerShown: true,
    },
    {
      kind: "the requirement is UNKNOWN",
      consent: requirementUnknown,
      bannerShown: true,
    },
    {
      kind: "the consent flow failed, so the requirement is unknown",
      consent: new Error("Consent information is unavailable."),
      bannerShown: false,
    },
  ])(
    "AC-2 when $kind, no entry point is shown",
    async ({ consent, bannerShown }) => {
      mockSdk.consent = consent;
      await launch();
      // The app has finished starting ads before the absence is checked.
      if (bannerShown) await waitForBanner();
      await settle();

      expect(queryEntryPoint()).toBeNull();
      expect(mockSdk.formsOpened).toBe(0);
    },
  );

  test.each([
    {
      kind: "declining personalisation",
      choices: userChoices(false),
    },
    {
      kind: "refusing only storage and access on the device",
      choices: {
        ...userChoices(true),
        storeAndAccessInformationOnDevice: false,
      },
    },
    {
      kind: "refusing only personalised ads",
      choices: { ...userChoices(true), selectPersonalisedAds: false },
    },
  ])(
    "AC-3 after $kind in the form, the next ad requests are non-personalised only",
    async ({ choices }) => {
      mockSdk.choices = userChoices(true);
      mockSdk.form = { consent: consentGiven, choices };
      await launch();
      await waitForBanner();

      await changeConsentThroughForm();

      const after = await waitForRequestAfterForm();
      for (const request of after) {
        expect(nonPersonalised(request)).toBe(true);
      }
    },
  );

  test("AC-3 after allowing personalisation in the form, the next ad requests are no longer limited to non-personalised ads", async () => {
    mockSdk.choices = userChoices(false);
    mockSdk.form = { consent: consentGiven, choices: userChoices(true) };
    await launch();
    await waitForBanner();
    for (const request of mockSdk.requests) {
      expect(nonPersonalised(request)).toBe(true);
    }

    await changeConsentThroughForm();

    const after = await waitForRequestAfterForm();
    for (const request of after) {
      expect(nonPersonalised(request)).toBe(false);
    }
  });

  test("AC-3 after withdrawing consent in the form, no further ad is requested and the entry point stays available", async () => {
    mockSdk.form = { consent: consentWithheld, choices: userChoices(false) };
    await launch();
    await waitForBanner();

    await changeConsentThroughForm();
    await settle();

    expect(mockSdk.formsClosed).toBe(1);
    expect(requestsAfterForm()).toEqual([]);
    expect(await findEntryPoint()).toBeTruthy();
  });

  test("AC-3 after giving consent in the form that was withheld at launch, a banner is requested", async () => {
    mockSdk.consent = consentWithheld;
    mockSdk.choices = userChoices(false);
    mockSdk.form = { consent: consentGiven, choices: userChoices(true) };
    await launch();
    await findEntryPoint();
    await settle();
    expect(mockSdk.requests).toEqual([]);

    await changeConsentThroughForm();

    await waitForRequestAfterForm();
    await rntl.waitFor(() => {
      expect(adRegion().getByTestId(bannerTestId)).toBeTruthy();
    });
  });

  test("AC-4 when the privacy-options form fails to open, every core feature works", async () => {
    mockSdk.form = new Error("The privacy options form is unavailable.");
    await launch();
    await waitForBanner();

    await changeConsentThroughForm();

    expect(mockSdk.formsOpened).toBe(1);
    await expectCoreFeaturesUsable();
  });
});
