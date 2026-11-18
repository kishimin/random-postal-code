import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAdsStartup, type Ads } from "./use-ads-startup";

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
  let close: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    close = () => {
      resolve();
    };
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

/**
 * Presses the entry point and lets the form flow end.
 * @param {{ current: Ads }} result - The hook result.
 */
const pressAndSettle = async (result: { current: Ads }) => {
  await act(async () => {
    result.current.openPrivacyOptions();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
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

  test("keeps the revision when the form closes with the same decision", async () => {
    const result = await renderStarted();
    const before = result.current.state;

    await pressAndSettle(result);

    expect(mockSdk.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
    expect(result.current.revision).toBe(0);
    expect(result.current.state).toEqual(before);
  });

  test("goes on as it was when the form fails to open, without an unhandled rejection", async () => {
    mockSdk.showPrivacyOptionsForm.mockRejectedValue(new Error("no form"));
    const unhandled = jest.fn();
    process.on("unhandledRejection", unhandled);
    const result = await renderStarted();
    const before = result.current.state;

    await pressAndSettle(result);

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(result.current.revision).toBe(0);
    expect(result.current.state).toEqual(before);
    expect(result.current.privacyOptionsRequired).toBe(true);
  });

  test("raises the revision by one for each form that changes the decision", async () => {
    const result = await renderStarted();

    mockSdk.getConsentInfo.mockResolvedValue(consentInfo(false));
    await pressAndSettle(result);
    expect(result.current.revision).toBe(1);
    expect(result.current.state).toEqual({ status: "unavailable" });

    mockSdk.getConsentInfo.mockResolvedValue(consentInfo(true));
    await pressAndSettle(result);
    expect(result.current.revision).toBe(2);
    expect(result.current.state.status).toBe("ready");

    await pressAndSettle(result);
    expect(result.current.revision).toBe(2);
  });

  test("leaves a screen that closed while the form was open alone", async () => {
    const form = gate();
    mockSdk.showPrivacyOptionsForm.mockImplementation(() => form.promise);
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = await renderHook(() => useAdsStartup());
    await waitFor(() => {
      expect(result.current.privacyOptionsRequired).toBe(true);
    });
    await act(() => {
      result.current.openPrivacyOptions();
    });

    await unmount();
    mockSdk.getConsentInfo.mockResolvedValue(consentInfo(false));
    form.close();
    await form.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
