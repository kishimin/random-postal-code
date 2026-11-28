import type { ConfigContext, ExpoConfig } from "expo/config";
// Expo loads this file with Node, which does not resolve an extensionless
// import of a TypeScript file.
import {
  assertProductionAdMobEnv,
  resolveAdMobAppIds,
} from "./src/config/admob-app-ids.ts";
import { withExitTrace } from "./src/config/exit-trace-plugin.ts";

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
// R8 shrinks the release build and removed the no-argument constructor of
// WorkManager's generated Room database (WorkDatabase_Impl), which Room
// creates by reflection. The Google Mobile Ads SDK starts WorkManager while
// the app process starts, so the production build closed at launch with
// "Failed to create an instance of androidx.work.impl.WorkDatabase"
// (seen on a Pixel 9a, 2026-11-24). Keeping every Room database's
// constructor is narrower than turning shrinking off.
const androidProguardRules =
  "-keep class * extends androidx.room.RoomDatabase { <init>(); }";

// The diagnostic build shrinks and optimises like production, but keeps
// class names, so the stack the exit trace logs is readable without the
// R8 mapping of that one build (Issue #173). Obfuscation only renames.
const diagnosticProguardRules = [androidProguardRules, "-dontobfuscate"].join(
  "\n",
);

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
  // EAS sets this while it resolves the configuration of a build.
  const profile = process.env.EAS_BUILD_PROFILE;
  const production = profile === "production";
  // The release build of Issue #173 with the System.exit trace. It stays on
  // Google's test AdMob IDs: only the production profile may hold the real
  // ones (docs/google-play-release-checklist.md).
  const diagnostic = profile === "diagnostic";
  const releaseManifest = production || diagnostic;
  if (production) {
    assertProductionAdMobEnv({
      ADMOB_ANDROID_APP_ID: process.env.ADMOB_ANDROID_APP_ID,
      ADMOB_IOS_APP_ID: process.env.ADMOB_IOS_APP_ID,
      EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID:
        process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID,
      EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS:
        process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS,
    });
  }
  const appIds = resolveAdMobAppIds({
    ADMOB_ANDROID_APP_ID: process.env.ADMOB_ANDROID_APP_ID,
    ADMOB_IOS_APP_ID: process.env.ADMOB_IOS_APP_ID,
  });

  const resolved: ExpoConfig = {
    ...config,
    name: config.name ?? "Zipnami",
    slug: config.slug ?? "zipnami",
    android: {
      ...config.android,
      ...(releaseManifest
        ? { blockedPermissions: unusedAndroidPermissions }
        : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: appIds.android,
          iosAppId: appIds.ios,
          // Without this the SDK starts measuring when the app launches,
          // before the person has answered the consent form. initialize()
          // starts it once consent has been gathered.
          delayAppMeasurementInit: true,
        },
      ],
      [
        "expo-tracking-transparency",
        { userTrackingPermission: trackingDescription },
      ],
      [
        "expo-build-properties",
        {
          android: {
            extraProguardRules: diagnostic
              ? diagnosticProguardRules
              : androidProguardRules,
          },
        },
      ],
    ],
  };
  return diagnostic ? withExitTrace(resolved) : resolved;
};
