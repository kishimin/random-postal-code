import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import mobileAds, { AdsConsent } from "react-native-google-mobile-ads";
import {
  changePrivacyOptions,
  launchAds,
  type AdsSnapshot,
  type PrivacyOptionsPorts,
} from "../lib/ads-privacy-options";
import type { AdsStartup } from "../lib/ads-startup";

export type AdsState = AdsStartup | { status: "pending" };

export type Ads = {
  /** Whether a banner may be requested yet, and how. */
  state: AdsState;
  /**
   * Changes with every new decision about ads, so a banner keyed by it is a
   * new banner that requests an ad under the new decision.
   */
  revision: number;
  /**
   * Whether the privacy-options flow is under way, from the press until the
   * new decision is applied or the flow fails. No ad may be requested
   * meanwhile: consent may have been withdrawn and the decision is stale.
   */
  changingPrivacyOptions: boolean;
  /** Whether the privacy-options form is to be offered. */
  privacyOptionsRequired: boolean;
  /** Opens the privacy-options form; never rejects. */
  openPrivacyOptions: () => void;
};

const ports: PrivacyOptionsPorts = {
  gatherConsent: () => AdsConsent.gatherConsent(),
  readConsentInfo: () => AdsConsent.getConsentInfo(),
  showPrivacyOptions: () => AdsConsent.showPrivacyOptionsForm(),
  readUserChoices: () => AdsConsent.getUserChoices(),
  // Only iOS has App Tracking Transparency.
  askTracking:
    Platform.OS === "ios"
      ? async () => (await requestTrackingPermissionsAsync()).granted
      : undefined,
  initialize: () => mobileAds().initialize(),
};

type Decision = { state: AdsState; privacyOptionsRequired: boolean };

const pending: Decision = {
  state: { status: "pending" },
  privacyOptionsRequired: false,
};

const decisionOf = (snapshot: AdsSnapshot): Decision => ({
  state: snapshot.ads,
  privacyOptionsRequired: snapshot.privacyOptionsRequired,
});

const sameState = (a: AdsState, b: AdsState): boolean =>
  a.status === "ready" && b.status === "ready"
    ? a.nonPersonalizedOnly === b.nonPersonalizedOnly
    : a.status === b.status;

const sameDecision = (a: Decision, b: Decision): boolean =>
  a.privacyOptionsRequired === b.privacyOptionsRequired &&
  sameState(a.state, b.state);

/**
 * Starts the ad SDK for as long as the screen is shown: consent first, then
 * (iOS) the tracking prompt, then the SDK. It runs once per mount, so each
 * launch of the app asks again, and it never throws: when ads cannot be
 * shown the state is "unavailable". It also lets the person reopen the
 * privacy-options form (Issue #146) and follows what they choose there.
 * @returns {Ads} The ad state and the way to change the person's consent.
 */
export const useAdsStartup = (): Ads => {
  const [decision, setDecision] = useState<Decision>(pending);
  const [revision, setRevision] = useState(0);
  const [changing, setChanging] = useState(false);
  // The decision on screen, which the handler compares a new one with
  // without being recreated each time it changes.
  const current = useRef<Decision>(pending);
  const mounted = useRef(false);
  // The form is modal, but a second press can land before it appears.
  const formOpen = useRef(false);

  // The SDKs are external systems: the effect starts them and keeps the
  // screen in step with the answer.
  useEffect(() => {
    mounted.current = true;
    const unmounted = new AbortController();
    void launchAds(ports).then((snapshot) => {
      if (unmounted.signal.aborted) return;
      current.current = decisionOf(snapshot);
      setDecision(current.current);
    });
    return () => {
      mounted.current = false;
      unmounted.abort();
    };
  }, []);

  // A press is an event, not a sync with an external system, so it is a
  // handler and not an effect.
  const openPrivacyOptions = useCallback(() => {
    if (formOpen.current) return;
    formOpen.current = true;
    setChanging(true);
    void changePrivacyOptions(ports)
      .then((snapshot) => {
        // Undefined means the form did not open: nothing has changed.
        if (snapshot === undefined || !mounted.current) return;
        const next = decisionOf(snapshot);
        // A new revision makes a new banner, which forgets how often its
        // ad failed to load (Issue #15). Opening the form and closing it
        // without a change must not hand a failing banner fresh retries.
        if (sameDecision(current.current, next)) return;
        current.current = next;
        setDecision(next);
        setRevision((previous) => previous + 1);
      })
      .finally(() => {
        formOpen.current = false;
        if (mounted.current) setChanging(false);
      });
  }, []);

  return {
    state: decision.state,
    revision,
    changingPrivacyOptions: changing,
    privacyOptionsRequired: decision.privacyOptionsRequired,
    openPrivacyOptions,
  };
};
