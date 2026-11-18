/**
 * The steps that must finish before the first ad request, as the app sees
 * them. The SDKs behind them are native modules, so the screen supplies them
 * and this module stays free of React Native.
 */
export type AdsPorts = {
  /** Runs the consent flow (Google's UMP) and reports where it ended. */
  gatherConsent: () => Promise<{ canRequestAds: boolean; status: string }>;
  /** Whether the person allowed personalised ads in the consent form. */
  choosesPersonalisedAds: () => Promise<boolean>;
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

// The status the SDK reports once the person has answered the consent form.
const consentObtained = "OBTAINED";

const personalisationAllowed = async (
  ports: AdsPorts,
  consentStatus: string,
): Promise<boolean> => {
  // Without a form there are no choices to honour.
  if (consentStatus !== consentObtained) return true;
  try {
    return await ports.choosesPersonalisedAds();
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
