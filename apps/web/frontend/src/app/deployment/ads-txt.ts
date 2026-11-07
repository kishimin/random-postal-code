// Extension included because this file is also imported by vite.config.ts,
// type checked under module: nodenext (as in deploy-settings.ts).
import { DEV_ADSENSE_CLIENT_ID_PLACEHOLDER } from "../schemas/env.schema.ts";

const PUBLISHER_CLIENT_ID = /^ca-(pub-\d{16})$/;

// Google's certification authority ID, the same for every AdSense publisher.
const GOOGLE_CERTIFICATION_AUTHORITY_ID = "f08c47fec0942fa0";

/**
 * Returns the ads.txt that authorizes Google to sell the site's ad inventory
 * for the publisher the ad code names, or null when the build has no real
 * publisher.
 *
 * Derived from the same client ID the ad code is built with rather than kept
 * as a static file in public/: a static copy would be a second place to change
 * when the publisher changes, and nothing would notice the two disagreeing
 * until AdSense flagged the site.
 */
export const adsTxtFor = (clientId: string): string | null => {
  if (clientId === DEV_ADSENSE_CLIENT_ID_PLACEHOLDER) return null;

  const publisherId = PUBLISHER_CLIENT_ID.exec(clientId)?.[1];
  if (publisherId === undefined) {
    throw new Error(
      "VITE_GOOGLE_ADSENSE_CLIENT_ID is not an AdSense publisher ID (ca-pub- followed by 16 digits), so no ads.txt can name it",
    );
  }

  return `google.com, ${publisherId}, DIRECT, ${GOOGLE_CERTIFICATION_AUTHORITY_ID}\n`;
};
