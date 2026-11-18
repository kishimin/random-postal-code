/**
 * The AdMob app IDs written into the native projects (Issue #15). They are
 * read when the native configuration is resolved, from `app.config.ts`, not
 * from the bundle, so they use plain names without the `EXPO_PUBLIC_` prefix.
 */
export type AdMobAppIds = {
  readonly android: string;
  readonly ios: string;
};

/**
 * Google's published sample app IDs. A build without the owner's IDs starts
 * the SDK with these, so development never touches a real AdMob account.
 */
export const googleTestAppIds: AdMobAppIds = {
  android: "ca-app-pub-3940256099942544~3347511713",
  ios: "ca-app-pub-3940256099942544~1458002511",
};

export type AdMobEnv = {
  readonly ADMOB_ANDROID_APP_ID?: string | undefined;
  readonly ADMOB_IOS_APP_ID?: string | undefined;
};

// An empty value, which a variable listed in .env with nothing after `=`
// arrives as, means "not configured".
const configured = (value: string | undefined): string | undefined =>
  value === undefined || value === "" ? undefined : value;

/**
 * Picks each platform's AdMob app ID.
 * @param {AdMobEnv} env - The environment the configuration is resolved in.
 * @returns {AdMobAppIds} The configured IDs, with Google's test ID for any that is unset.
 */
export const resolveAdMobAppIds = (env: AdMobEnv): AdMobAppIds => ({
  android: configured(env.ADMOB_ANDROID_APP_ID) ?? googleTestAppIds.android,
  ios: configured(env.ADMOB_IOS_APP_ID) ?? googleTestAppIds.ios,
});
