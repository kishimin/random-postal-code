import type { ConfigContext, ExpoConfig } from "expo/config";
// Expo loads this file with Node, which does not resolve an extensionless
// import of a TypeScript file.
import { resolveAdMobAppIds } from "./src/config/admob-app-ids.ts";

/*
 * app.json stays the static base (identifiers, icons, routing). This file
 * adds what depends on the environment: the AdMob app IDs, which differ
 * between Google's test IDs and the owner's production IDs (Issue #15).
 */

// Why the person is asked for tracking permission on iOS. The prompt itself
// is drawn by iOS; only this explanation is ours.
const trackingDescription =
  "広告をお客様に合ったものにするため、他社のアプリやWebサイトをまたいだ利用状況の取得を許可していただけますか。許可しなくても、アプリのすべての機能を使えます。";

// Permissions that Expo's defaults or a library's manifest add, but that the
// app never uses. A production build asks for the network and the advertising
// ID only. Development builds keep them: the dev client draws its menu over
// other apps (SYSTEM_ALERT_WINDOW).
const unusedAndroidPermissions = [
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.VIBRATE",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
];

/**
 * Extends app.json with the environment-dependent native configuration.
 * @param {ConfigContext} context - The static config Expo read from app.json.
 * @returns {ExpoConfig} The config with AdMob, tracking and permission settings.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const appIds = resolveAdMobAppIds({
    ADMOB_ANDROID_APP_ID: process.env.ADMOB_ANDROID_APP_ID,
    ADMOB_IOS_APP_ID: process.env.ADMOB_IOS_APP_ID,
  });
  // EAS sets this while it resolves the configuration of a build.
  const production = process.env.EAS_BUILD_PROFILE === "production";

  return {
    ...config,
    name: config.name ?? "Zipnami",
    slug: config.slug ?? "zipnami",
    android: {
      ...config.android,
      ...(production ? { blockedPermissions: unusedAndroidPermissions } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      [
        "react-native-google-mobile-ads",
        { androidAppId: appIds.android, iosAppId: appIds.ios },
      ],
      [
        "expo-tracking-transparency",
        { userTrackingPermission: trackingDescription },
      ],
    ],
  };
};
