/** The consent purposes that decide whether an ad may be personalised. */
export type UserChoices = {
  readonly selectPersonalisedAds: boolean;
  readonly storeAndAccessInformationOnDevice: boolean;
};

/**
 * The steps that must finish before the first ad request, as the app sees
 * them. The SDKs behind them are native modules, so the screen supplies them
 * and this module stays free of React Native.
 */
export type AdsPorts = {
  /** Runs the consent flow (Google's UMP) and reports where it ended. */
  gatherConsent: () => Promise<{ canRequestAds: boolean; status: string }>;
  /** What the person allowed in the consent form (UMP's user choices). */
  readUserChoices: () => Promise<UserChoices>;
  /**
   * Asks for App Tracking Transparency; true when the person allowed it.
   * Undefined where the platform has no such prompt.
   */
  askTracking: (() => Promise<boolean>) | undefined;
  /** Starts the Mobile Ads SDK. */
  initialize: () => Promise<unknown>;
};

export type AdsStartup =
  { status: "unavailable" } | { status: "ready"; nonPersonalizedOnly: boolean };

// The status the SDK reports where no consent form is needed at all.
const consentNotRequired = "NOT_REQUIRED";

const personalisationAllowed = async (
  ports: AdsPorts,
  consentStatus: string,
): Promise<boolean> => {
  // Without a form there are no choices to honour. Every other status,
  // including one this code does not know, may have a stored refusal behind
  // it, so the choices decide.
  if (consentStatus === consentNotRequired) return true;
  try {
    const choices = await ports.readUserChoices();
    // Personalising needs the device to be read as well as the ad selected.
    return (
      choices.selectPersonalisedAds && choices.storeAndAccessInformationOnDevice
    );
  } catch {
    // Not knowing what the person chose is treated as a refusal.
    return false;
  }
};

const trackingAllowed = async (ports: AdsPorts): Promise<boolean> => {
  if (ports.askTracking === undefined) return true;
  try {
    return await ports.askTracking();
  } catch {
    return false;
  }
};

/**
 * Runs consent, then the tracking prompt, then starts the SDK, and says what
 * ads may be requested. Every failure is absorbed: ads are an extra, and the
 * features of the app never wait on them or break with them.
 * @param {AdsPorts} ports - The SDK steps.
 * @returns {Promise<AdsStartup>} Whether to show a banner, and whether it may be personalised.
 */
export const startAds = async (ports: AdsPorts): Promise<AdsStartup> => {
  try {
    const consent = await ports.gatherConsent();
    if (!consent.canRequestAds) return { status: "unavailable" };

    const personalised = await personalisationAllowed(ports, consent.status);
    // The tracking prompt comes after the consent form so that the person
    // answers one question at a time.
    const tracked = await trackingAllowed(ports);
    await ports.initialize();
    return { status: "ready", nonPersonalizedOnly: !(personalised && tracked) };
  } catch {
    return { status: "unavailable" };
  }
};
