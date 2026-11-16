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

/**
 * Reads the configuration from the variables as Expo inlines them, treating
 * an empty value as unset.
 */
export const readMobileConfig = (env: {
  apiBaseUrl: string | undefined;
  adBannerUnitId: string | undefined;
}): MobileConfig => ({
  apiBaseUrl: env.apiBaseUrl || undefined,
  adBannerUnitId: env.adBannerUnitId || undefined,
});

// Expo replaces only the literal `process.env.EXPO_PUBLIC_…` expressions, so
// each variable is named in full here rather than read through a loop. Expo's
// types leave process.env untyped, so each value is narrowed to a string
// rather than trusted as `any`.
const fromBuild = (value: unknown) =>
  typeof value === "string" ? value : undefined;

export const mobileConfig = readMobileConfig({
  apiBaseUrl: fromBuild(process.env.EXPO_PUBLIC_API_BASE_URL),
  adBannerUnitId: fromBuild(process.env.EXPO_PUBLIC_AD_BANNER_UNIT_ID),
});
