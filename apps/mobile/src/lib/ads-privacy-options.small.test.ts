import { describe, expect, test } from "vitest";
import {
  changePrivacyOptions,
  launchAds,
  type ConsentInfo,
  type PrivacyOptionsPorts,
} from "./ads-privacy-options";

type Overrides = Partial<PrivacyOptionsPorts>;

const allAllowed = {
  selectPersonalisedAds: true,
  storeAndAccessInformationOnDevice: true,
};

const consentGiven: ConsentInfo = {
  canRequestAds: true,
  status: "OBTAINED",
  privacyOptionsRequirementStatus: "REQUIRED",
};

/**
 * Ports that answer "consent given, privacy options required, everything
 * allowed" and write the order they were called in to `calls`.
 * @param {string[]} calls - Where each step records its name.
 * @param {Overrides} overrides - Steps to replace for one scenario.
 * @returns {PrivacyOptionsPorts} The ports.
 */
const portsRecordingTo = (
  calls: string[],
  overrides: Overrides = {},
): PrivacyOptionsPorts => ({
  gatherConsent: () => {
    calls.push("consent");
    return Promise.resolve(consentGiven);
  },
  readConsentInfo: () => {
    calls.push("info");
    return Promise.resolve(consentGiven);
  },
  showPrivacyOptions: () => {
    calls.push("form");
    return Promise.resolve();
  },
  readUserChoices: () => {
    calls.push("choices");
    return Promise.resolve(allAllowed);
  },
  askTracking: () => {
    calls.push("tracking");
    return Promise.resolve(true);
  },
  initialize: () => {
    calls.push("initialize");
    return Promise.resolve();
  },
  ...overrides,
});

describe("launchAds", () => {
  test("starts the ads and reports that privacy options are required", async () => {
    const result = await launchAds(portsRecordingTo([]));

    expect(result).toEqual({
      ads: { status: "ready", nonPersonalizedOnly: false },
      privacyOptionsRequired: true,
    });
  });

  test("reports privacy options as required even when consent was withheld, so the person can give it", async () => {
    const result = await launchAds(
      portsRecordingTo([], {
        gatherConsent: () =>
          Promise.resolve({ ...consentGiven, canRequestAds: false }),
        readConsentInfo: () =>
          Promise.resolve({
            canRequestAds: false,
            status: "REQUIRED",
            privacyOptionsRequirementStatus: "REQUIRED",
          }),
      }),
    );

    expect(result).toEqual({
      ads: { status: "unavailable" },
      privacyOptionsRequired: true,
    });
  });

  test("offers no ad and no entry point when the consent flow and the consent information both fail", async () => {
    const result = await launchAds(
      portsRecordingTo([], {
        gatherConsent: () => Promise.reject(new Error("unavailable")),
        readConsentInfo: () => Promise.reject(new Error("unavailable")),
      }),
    );

    expect(result).toEqual({
      ads: { status: "unavailable" },
      privacyOptionsRequired: false,
    });
  });

  test.each(["NOT_REQUIRED", "UNKNOWN", "SOMETHING_NEW"])(
    "reports privacy options as not required when the SDK says %s",
    async (requirement) => {
      const result = await launchAds(
        portsRecordingTo([], {
          readConsentInfo: () =>
            Promise.resolve({
              ...consentGiven,
              privacyOptionsRequirementStatus: requirement,
            }),
        }),
      );

      expect(result.privacyOptionsRequired).toBe(false);
    },
  );

  test("reports privacy options as not required when the consent information cannot be read, and keeps the ads", async () => {
    const result = await launchAds(
      portsRecordingTo([], {
        readConsentInfo: () => Promise.reject(new Error("unavailable")),
      }),
    );

    expect(result).toEqual({
      ads: { status: "ready", nonPersonalizedOnly: false },
      privacyOptionsRequired: false,
    });
  });
});

describe("changePrivacyOptions", () => {
  test("opens the form, reads the consent information and the choices again, and requests ads from them", async () => {
    const calls: string[] = [];

    const result = await changePrivacyOptions(portsRecordingTo(calls));

    expect(calls).toEqual([
      "form",
      "info",
      "choices",
      "tracking",
      "initialize",
    ]);
    expect(result).toEqual({
      ads: { status: "ready", nonPersonalizedOnly: false },
      privacyOptionsRequired: true,
    });
  });

  test("limits the next ads to non-personalised ones when the person refuses personalisation in the form", async () => {
    const result = await changePrivacyOptions(
      portsRecordingTo([], {
        readUserChoices: () =>
          Promise.resolve({ ...allAllowed, selectPersonalisedAds: false }),
      }),
    );

    expect(result?.ads).toEqual({
      status: "ready",
      nonPersonalizedOnly: true,
    });
  });

  test("allows no further ad when the person withdraws consent, and keeps the entry point", async () => {
    const calls: string[] = [];

    const result = await changePrivacyOptions(
      portsRecordingTo(calls, {
        readConsentInfo: () =>
          Promise.resolve({
            canRequestAds: false,
            status: "REQUIRED",
            privacyOptionsRequirementStatus: "REQUIRED",
          }),
      }),
    );

    expect(result).toEqual({
      ads: { status: "unavailable" },
      privacyOptionsRequired: true,
    });
    expect(calls).not.toContain("initialize");
  });

  test("stops offering the form when the SDK no longer requires privacy options", async () => {
    const result = await changePrivacyOptions(
      portsRecordingTo([], {
        readConsentInfo: () =>
          Promise.resolve({
            ...consentGiven,
            privacyOptionsRequirementStatus: "NOT_REQUIRED",
          }),
      }),
    );

    expect(result?.privacyOptionsRequired).toBe(false);
  });

  test("changes nothing when the form fails to open", async () => {
    const calls: string[] = [];

    const result = await changePrivacyOptions(
      portsRecordingTo(calls, {
        showPrivacyOptions: () => Promise.reject(new Error("no form")),
      }),
    );

    expect(result).toBeUndefined();
    expect(calls).toEqual([]);
  });

  test("allows no ad when the consent information cannot be read after the form", async () => {
    const result = await changePrivacyOptions(
      portsRecordingTo([], {
        readConsentInfo: () => Promise.reject(new Error("unavailable")),
      }),
    );

    expect(result).toEqual({
      ads: { status: "unavailable" },
      privacyOptionsRequired: true,
    });
  });
});
