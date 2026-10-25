// Extension included because scripts/verify-deploy-env.ts pulls this file
// into the node project, type checked under module: nodenext, where an
// extensionless relative specifier does not resolve (as in vite.config.ts).
import {
  DEV_ADSENSE_CLIENT_ID_PLACEHOLDER,
  DEV_ADSENSE_SLOT_ID_PLACEHOLDER,
} from "../schemas/env.schema.ts";

export type FrontendDeploySettings = Partial<
  Record<
    | "VITE_API_BASE_URL"
    | "VITE_GOOGLE_ADSENSE_CLIENT_ID"
    | "VITE_GOOGLE_ADSENSE_SLOT_ID"
    | "VITE_ADSENSE_TEST_MODE",
    string
  >
>;

const isHttpsUrl = (value: string | undefined): boolean =>
  value !== undefined &&
  URL.canParse(value) &&
  new URL(value).protocol === "https:";

/*
 * Each check pairs a setting with the message that names it. The messages
 * never include the value: a production deploy log is shared, and design.md
 * section 10 says not to print secrets there.
 *
 * The application itself accepts every one of these missing (parseAppEnv
 * falls back to the AdSense placeholders and to test ads), which is right
 * for development and wrong for production: a deploy without them would
 * quietly serve test ads, or none, with nothing failing.
 */
const checks: [
  keyof FrontendDeploySettings,
  (value: string | undefined) => boolean,
  string,
][] = [
  [
    "VITE_API_BASE_URL",
    isHttpsUrl,
    "VITE_API_BASE_URL must be the production Worker's https URL",
  ],
  [
    "VITE_GOOGLE_ADSENSE_CLIENT_ID",
    (value) =>
      value !== undefined &&
      /^ca-pub-\d{16}$/.test(value) &&
      value !== DEV_ADSENSE_CLIENT_ID_PLACEHOLDER,
    "VITE_GOOGLE_ADSENSE_CLIENT_ID must be the production AdSense publisher ID (ca-pub- followed by 16 digits), not the development placeholder",
  ],
  [
    "VITE_GOOGLE_ADSENSE_SLOT_ID",
    (value) =>
      value !== undefined &&
      /^\d+$/.test(value) &&
      value !== DEV_ADSENSE_SLOT_ID_PLACEHOLDER,
    "VITE_GOOGLE_ADSENSE_SLOT_ID must be the production ad unit's numeric slot ID, not the development placeholder",
  ],
  [
    "VITE_ADSENSE_TEST_MODE",
    // The app shows test ads unless this is exactly "false" (parseAppEnv).
    (value) => value === "false",
    'VITE_ADSENSE_TEST_MODE must be "false" in production, or the site serves test ads',
  ],
];

/**
 * What is wrong with the build settings a production Pages deploy is about
 * to bake in, as one message per unusable setting.
 *
 * Maps settings are not checked yet: the Maps integration (Issue #8) has
 * not merged, so the build reads none. Its settings belong here when it
 * does.
 */
export const problemsWithFrontendDeploySettings = (
  settings: FrontendDeploySettings,
): string[] =>
  checks
    .filter(([name, isUsable]) => !isUsable(settings[name]))
    .map(([, , problem]) => problem);
