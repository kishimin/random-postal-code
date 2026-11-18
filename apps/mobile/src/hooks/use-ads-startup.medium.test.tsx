import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAdsStartup } from "./use-ads-startup";

// jest.mock factories may only reach variables whose names start with `mock`.
// The fakes answer as the SDK does for a person in a region that requires the
// privacy-options form; the factory reads them when an SDK step is called, not
// when the module loads.
const mockSdk = {
  getConsentInfo: jest.fn<() => Promise<unknown>>(),
  showPrivacyOptionsForm: jest.fn<() => Promise<unknown>>(),
};

jest.mock("react-native-google-mobile-ads", () => ({
  __esModule: true,
  default: () => ({ initialize: async () => [] }),
  AdsConsent: {
    gatherConsent: async () => mockSdk.getConsentInfo(),
    getConsentInfo: () => mockSdk.getConsentInfo(),
    showPrivacyOptionsForm: () => mockSdk.showPrivacyOptionsForm(),
    getUserChoices: async () => ({
      selectPersonalisedAds: true,
      storeAndAccessInformationOnDevice: true,
    }),
  },
}));

jest.mock("expo-tracking-transparency", () => ({
  __esModule: true,
  requestTrackingPermissionsAsync: async () => ({
    status: "granted",
    granted: true,
  }),
}));

const consentInfo = (canRequestAds: boolean) => ({
  canRequestAds,
  status: canRequestAds ? "OBTAINED" : "REQUIRED",
  privacyOptionsRequirementStatus: "REQUIRED",
});

/**
 * A promise the test settles by hand, to keep the form open as long as needed.
 * @returns {{ promise: Promise<void>, close: () => void }} The promise and the way to settle it.
 */
const gate = () => {
  let close = () => undefined;
  const promise = new Promise<void>((resolve) => {
    close = resolve;
  });
  return { promise, close };
};

/**
 * Renders the hook once the launch has ended, so the entry point is on offer.
 * @returns {Promise<{ current: ReturnType<typeof useAdsStartup> }>} The hook result.
 */
const renderStarted = async () => {
  const { result } = await renderHook(() => useAdsStartup());
  await waitFor(() => {
    expect(result.current.privacyOptionsRequired).toBe(true);
  });
  return result;
};

beforeEach(() => {
  mockSdk.getConsentInfo.mockResolvedValue(consentInfo(true));
  mockSdk.showPrivacyOptionsForm.mockResolvedValue(undefined);
});

describe("useAdsStartup privacy options", () => {
  test("opens the form once however often the entry point is pressed while it is open", async () => {
    const form = gate();
    mockSdk.showPrivacyOptionsForm.mockImplementation(() => form.promise);
    const result = await renderStarted();

    await act(() => {
      result.current.openPrivacyOptions();
      result.current.openPrivacyOptions();
    });
    await act(async () => {
      mockSdk.getConsentInfo.mockResolvedValue(consentInfo(false));
      form.close();
      await form.promise;
    });

    await waitFor(() => {
      expect(result.current.revision).toBe(1);
    });
    expect(mockSdk.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
  });

  test("opens the form again on a press after it has closed", async () => {
    const result = await renderStarted();

    await act(async () => {
      result.current.openPrivacyOptions();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mockSdk.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
    });
    // Flush the continuation that releases the guard.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(() => {
      result.current.openPrivacyOptions();
    });

    expect(mockSdk.showPrivacyOptionsForm).toHaveBeenCalledTimes(2);
  });
});
