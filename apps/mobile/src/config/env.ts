/**
 * Build-time configuration. Expo inlines `EXPO_PUBLIC_*` variables into the
 * bundle when it is built, from the shell or from apps/mobile/.env (ignored
 * by Git; .env.example lists the names). Nothing here is a secret: an API
 * origin and an ad unit ID are public once the app ships.
 */
export type AdBannerUnitIds = {
  readonly android: string | undefined;
  readonly ios: string | undefined;
};

export type MobileConfig = {
  readonly apiBaseUrl: string | undefined;
  /** The production banner unit of each store's app, when configured. */
  readonly adBannerUnitIds: AdBannerUnitIds;
};

// Expo's types leave process.env untyped, so a value is checked to be a
// string rather than trusted as `any`. An empty string, which a variable
// listed in .env with nothing after `=` arrives as, means "not configured".
const setting = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

/**
 * Reads the configuration from the variables as Expo inlines them.
 */
export const readMobileConfig = (env: {
  apiBaseUrl: unknown;
  /** Issue #12's shared unit, kept as an alias for the Android unit. */
  adBannerUnitId: unknown;
  adBannerUnitIdAndroid: unknown;
  adBannerUnitIdIos: unknown;
}): MobileConfig => ({
  apiBaseUrl: setting(env.apiBaseUrl),
  adBannerUnitIds: {
    // An AdMob unit belongs to one app, so the shared variable, which was
    // created before the units were split, cannot also stand in for iOS.
    android: setting(env.adBannerUnitIdAndroid) ?? setting(env.adBannerUnitId),
    ios: setting(env.adBannerUnitIdIos),
  },
});

// Expo replaces only the literal `process.env.EXPO_PUBLIC_…` expressions, so
// each variable is named in full here rather than read through a loop.
export const mobileConfig = readMobileConfig({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  adBannerUnitId: process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID,
  adBannerUnitIdAndroid: process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID,
  adBannerUnitIdIos: process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS,
});
