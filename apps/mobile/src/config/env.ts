/**
 * Build-time configuration. Expo inlines `EXPO_PUBLIC_*` variables into the
 * bundle when it is built, from the shell or from apps/mobile/.env (ignored
 * by Git; .env.example lists the names). Nothing here is a secret: an API
 * origin and an ad unit ID are public once the app ships.
 */
export type MobileConfig = {
  readonly apiBaseUrl: string | undefined;
  readonly adBannerUnitId: string | undefined;
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
  adBannerUnitId: unknown;
}): MobileConfig => ({
  apiBaseUrl: setting(env.apiBaseUrl),
  adBannerUnitId: setting(env.adBannerUnitId),
});

// Expo replaces only the literal `process.env.EXPO_PUBLIC_…` expressions, so
// each variable is named in full here rather than read through a loop.
export const mobileConfig = readMobileConfig({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  adBannerUnitId: process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID,
});
