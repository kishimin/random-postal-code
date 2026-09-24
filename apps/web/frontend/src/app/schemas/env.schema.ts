import { z } from "zod";

export type AppEnv = {
  apiBaseUrl: string;
  googleAdsenseClientId: string;
  googleAdsenseSlotId: string;
  useTestAds: boolean;
};

// Not a real, restricted publisher ID. AdSense is an optional dependency
// (design.md section 7): a build with no VITE_GOOGLE_ADSENSE_CLIENT_ID set
// still renders, requesting ads under this placeholder instead of failing
// the build the way a missing VITE_API_BASE_URL does above.
const DEV_ADSENSE_CLIENT_ID_PLACEHOLDER = "ca-pub-0000000000000000";

// Not a real, restricted ad slot ID. Same optional-dependency contract as the
// client ID placeholder above: a build with no VITE_GOOGLE_ADSENSE_SLOT_ID set
// still renders, requesting this placeholder slot instead of failing the
// build.
const DEV_ADSENSE_SLOT_ID_PLACEHOLDER = "0000000000";

// The URL constructor rather than a pattern: it rejects a bare host:port and a
// relative path the same way a browser would, and it exposes the protocol so a
// non-http scheme cannot slip through.
const isAbsoluteHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().refine(isAbsoluteHttpUrl),
  // Both optional and left as plain strings rather than z.enum: unlike
  // VITE_API_BASE_URL, an advertising variable failing here must not throw
  // and take an otherwise valid build down with it (design.md section 7).
  VITE_GOOGLE_ADSENSE_CLIENT_ID: z.string().optional(),
  VITE_GOOGLE_ADSENSE_SLOT_ID: z.string().optional(),
  VITE_ADSENSE_TEST_MODE: z.string().optional(),
});

/**
 * Validates the build-time environment the application depends on.
 *
 * Takes the environment as an argument rather than reading `import.meta.env`
 * directly, so the rules can be exercised without building the application.
 *
 * Throws instead of falling back to a default. A build that shipped without the
 * variable would otherwise request `undefined/api/random` at runtime, and the
 * first sign of it would be a failed request in a user's browser.
 */
export const parseAppEnv = (env: Record<string, unknown>): AppEnv => {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    throw new Error(
      "VITE_API_BASE_URL must be set to an absolute http or https URL at build time.",
    );
  }

  return {
    apiBaseUrl: result.data.VITE_API_BASE_URL,
    googleAdsenseClientId:
      result.data.VITE_GOOGLE_ADSENSE_CLIENT_ID ??
      DEV_ADSENSE_CLIENT_ID_PLACEHOLDER,
    googleAdsenseSlotId:
      result.data.VITE_GOOGLE_ADSENSE_SLOT_ID ??
      DEV_ADSENSE_SLOT_ID_PLACEHOLDER,
    // Fails safe: anything other than the exact opt-out keeps test ads,
    // rather than requiring an exact opt-in that a future default could miss.
    useTestAds: result.data.VITE_ADSENSE_TEST_MODE !== "false",
  };
};
