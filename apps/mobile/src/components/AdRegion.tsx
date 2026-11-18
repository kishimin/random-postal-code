import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { mobileConfig } from "../config/env";
import type { AdsState } from "../hooks/use-ads-startup";
import {
  bannerRetryDelayMs,
  selectBannerUnitId,
  selectPlatformUnitId,
} from "../lib/ad-banner-policy";
import { generatorText } from "../lib/generator-text";

const productionUnitId = selectPlatformUnitId({
  os: Platform.OS,
  unitIds: mobileConfig.adBannerUnitIds,
});

/**
 * One banner. A banner that fails to load is requested again a bounded
 * number of times, after a growing wait, and then left alone: asking forever
 * would burn battery and data on a region that has no ad to show.
 * While the privacy options are being changed the retry waits: the consent
 * it would request under may already be withdrawn. Failures are kept, so the
 * retry budget is the same afterwards.
 */
const AdBanner = ({
  nonPersonalizedOnly,
  paused,
}: {
  nonPersonalizedOnly: boolean;
  paused: boolean;
}) => {
  const [failures, setFailures] = useState(0);
  // A new key is a new banner, which requests an ad again.
  const [attempt, setAttempt] = useState(0);

  // The timer is an external system the retry is kept in step with.
  useEffect(() => {
    const delay = bannerRetryDelayMs(failures);
    if (paused || delay === undefined) return undefined;
    const timer = setTimeout(() => {
      setAttempt((previous) => previous + 1);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [failures, paused]);

  return (
    <BannerAd
      key={attempt}
      unitId={selectBannerUnitId({
        development: __DEV__,
        productionId: productionUnitId,
        testId: TestIds.ADAPTIVE_BANNER,
      })}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={
        nonPersonalizedOnly ? { requestNonPersonalizedAdsOnly: true } : {}
      }
      onAdFailedToLoad={() => {
        setFailures((previous) => previous + 1);
      }}
    />
  );
};

/**
 * The region reserved for the AdMob banner (Issue #15). It holds the banner
 * and nothing else, outside every action of the screen, and it is there
 * whether or not an ad is: the app never waits for one. The privacy-options
 * entry point (Issue #146) is therefore not here but beside it.
 * @param {object} props - The component props.
 * @param {AdsState} props.state - Whether a banner may be requested, and how.
 * @param {number} props.revision - A new value is a new decision, which gets a new banner.
 * @param {boolean} props.changingPrivacyOptions - Whether the privacy options are being changed, so no ad may be requested.
 */
export const AdRegion = ({
  state,
  revision,
  changingPrivacyOptions,
}: {
  state: AdsState;
  revision: number;
  changingPrivacyOptions: boolean;
}) => (
  <View accessibilityLabel={generatorText.adRegionLabel} style={styles.region}>
    {state.status === "ready" ? (
      <AdBanner
        key={revision}
        nonPersonalizedOnly={state.nonPersonalizedOnly}
        paused={changingPrivacyOptions}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  region: { minHeight: 50 },
});
