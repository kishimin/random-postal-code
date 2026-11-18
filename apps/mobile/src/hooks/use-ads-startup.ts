import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import mobileAds, { AdsConsent } from "react-native-google-mobile-ads";
import { startAds, type AdsPorts, type AdsStartup } from "../lib/ads-startup";

export type AdsState = AdsStartup | { status: "pending" };

const ports: AdsPorts = {
  gatherConsent: () => AdsConsent.gatherConsent(),
  choosesPersonalisedAds: async () =>
    (await AdsConsent.getUserChoices()).selectPersonalisedAds,
  // Only iOS has App Tracking Transparency.
  askTracking:
    Platform.OS === "ios"
      ? async () => (await requestTrackingPermissionsAsync()).granted
      : undefined,
  initialize: () => mobileAds().initialize(),
};

/**
 * Starts the ad SDK for as long as the screen is shown: consent first, then
 * (iOS) the tracking prompt, then the SDK. It runs once per mount, so each
 * launch of the app asks again, and it never throws: when ads cannot be
 * shown the state is "unavailable".
 * @returns {AdsState} Whether a banner may be requested yet, and how.
 */
export const useAdsStartup = (): AdsState => {
  const [state, setState] = useState<AdsState>({ status: "pending" });

  // The SDKs are external systems: the effect starts them and keeps the
  // screen in step with the answer.
  useEffect(() => {
    const unmounted = new AbortController();
    void startAds(ports).then((startup) => {
      if (!unmounted.signal.aborted) setState(startup);
    });
    return () => {
      unmounted.abort();
    };
  }, []);

  return state;
};
