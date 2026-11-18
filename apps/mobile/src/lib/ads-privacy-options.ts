import {
  adsAfterConsent,
  startAds,
  type AdsPorts,
  type AdsStartup,
  type ConsentOutcome,
} from "./ads-startup";

/** The consent information the SDK reports, privacy options included. */
export type ConsentInfo = ConsentOutcome & {
  privacyOptionsRequirementStatus: string;
};

/** The ports of {@link AdsPorts} plus the ones the privacy-options form needs. */
export type PrivacyOptionsPorts = AdsPorts & {
  /** Reads the consent information as it stands now. */
  readConsentInfo: () => Promise<ConsentInfo>;
  /** Opens the privacy-options form and resolves when it closes. */
  showPrivacyOptions: () => Promise<unknown>;
};

/** What the screen shows: the ads, and whether the form can be reopened. */
export type AdsSnapshot = {
  ads: AdsStartup;
  privacyOptionsRequired: boolean;
};

// Only this status obliges the app to offer the form. NOT_REQUIRED and
// UNKNOWN, or a status this code does not know, offer nothing.
const privacyOptionsRequired = "REQUIRED";

/**
 * Reads the consent information, which is the one source of both answers
 * after the form closes.
 * @param {PrivacyOptionsPorts} ports - The SDK steps.
 * @returns {Promise<ConsentInfo | undefined>} The information, or undefined when it cannot be read.
 */
const readConsentInfo = async (
  ports: PrivacyOptionsPorts,
): Promise<ConsentInfo | undefined> => {
  try {
    return await ports.readConsentInfo();
  } catch {
    return undefined;
  }
};

const isRequired = (info: ConsentInfo | undefined): boolean =>
  info?.privacyOptionsRequirementStatus === privacyOptionsRequired;

/**
 * Starts the ads at launch, and says whether the privacy-options form is to
 * be offered. A failure to read the requirement only hides the entry point.
 * @param {PrivacyOptionsPorts} ports - The SDK steps.
 * @returns {Promise<AdsSnapshot>} The ads and whether the form is offered.
 */
export const launchAds = async (
  ports: PrivacyOptionsPorts,
): Promise<AdsSnapshot> => {
  const ads = await startAds(ports);
  return {
    ads,
    privacyOptionsRequired: isRequired(await readConsentInfo(ports)),
  };
};

/**
 * Opens the privacy-options form and, once it closes, works out again what
 * ads may be requested from what the person chose.
 * @param {PrivacyOptionsPorts} ports - The SDK steps.
 * @returns {Promise<AdsSnapshot | undefined>} The new state, or undefined when the form did not open and nothing changed.
 */
export const changePrivacyOptions = async (
  ports: PrivacyOptionsPorts,
): Promise<AdsSnapshot | undefined> => {
  try {
    await ports.showPrivacyOptions();
  } catch {
    // The form is an extra: the screen goes on as it was.
    return undefined;
  }
  const info = await readConsentInfo(ports);
  if (info === undefined) {
    // What the person chose is unknown, so no ad is requested. The form was
    // on offer a moment ago, so it stays on offer.
    return { ads: { status: "unavailable" }, privacyOptionsRequired: true };
  }
  return {
    ads: await adsAfterConsent(ports, info),
    privacyOptionsRequired: isRequired(info),
  };
};
