import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { mobileConfig } from "../config/env";
import { useAdsStartup } from "../hooks/use-ads-startup";
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
 */
const AdBanner = ({
  nonPersonalizedOnly,
}: {
  nonPersonalizedOnly: boolean;
}) => {
  const [failures, setFailures] = useState(0);
  // A new key is a new banner, which requests an ad again.
  const [attempt, setAttempt] = useState(0);

  // The timer is an external system the retry is kept in step with.
  useEffect(() => {
    const delay = bannerRetryDelayMs(failures);
    if (delay === undefined) return undefined;
    const timer = setTimeout(() => {
      setAttempt((previous) => previous + 1);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [failures]);

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
 * whether or not an ad is: the app never waits for one.
 */
export const AdRegion = () => {
  const ads = useAdsStartup();
  return (
    <View
      accessibilityLabel={generatorText.adRegionLabel}
      style={styles.region}
    >
      {ads.status === "ready" ? (
        <AdBanner nonPersonalizedOnly={ads.nonPersonalizedOnly} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  region: { minHeight: 50 },
});
