// Extension included because this file is also imported by vite.config.ts,
// type checked under module: nodenext (as in ads-txt.ts).
import { publisherIdOf } from "./ads-txt.ts";

/**
 * The AdSense account a page's `<meta name="google-adsense-account">` names,
 * or null when the build has no real publisher.
 *
 * The same rule as ads-txt.ts, so the account the pages claim and the seller
 * ads.txt authorizes cannot be two different publishers. The tag only says
 * whose site this is; it does not load the ad loader, so #120's rule that only
 * the result screen requests ads is untouched.
 * @param {string} clientId - The build's VITE_GOOGLE_ADSENSE_CLIENT_ID.
 */
export const adSenseAccountFor = (clientId: string): string | null => {
  const publisherId = publisherIdOf(
    clientId,
    "no account tag can name it",
  );

  return publisherId === null ? null : `ca-${publisherId}`;
};
