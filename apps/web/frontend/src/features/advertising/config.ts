/*
 * The AdSense loader Issue #9 integrates.
 *
 * acceptance/selectors/advertising-selectors.ts's advertisingScriptPattern
 * fixes this exact host and path as the request that counts toward the
 * bounded-retry criterion, so the URL built here has to match it.
 */
const ADSENSE_LOADER_URL =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

/**
 * Builds the AdSense loader script URL for a given publisher client ID.
 * @param {string} clientId - The `ca-pub-...` value env.schema.ts resolves.
 */
export const adsenseScriptUrl = (clientId: string): string =>
  `${ADSENSE_LOADER_URL}?client=${encodeURIComponent(clientId)}`;

/**
 * How many times the AdSense loader script is attempted before giving up.
 *
 * design.md section 7: "Ads must not ... retry indefinitely." Three attempts
 * is a bound chosen for this Issue, not a value AdSense itself documents.
 */
export const MAX_AD_SCRIPT_LOAD_ATTEMPTS = 3;

/**
 * Whether another attempt remains after `attemptNumber` has just failed.
 * @param {number} attemptNumber - The attempt that just failed (1 for the first).
 */
export const hasRemainingAdScriptAttempt = (attemptNumber: number): boolean =>
  attemptNumber < MAX_AD_SCRIPT_LOAD_ATTEMPTS;

/**
 * How long to wait before the attempt after `attemptNumber`.
 *
 * Grows with the attempt number so a run of failures backs off rather than
 * hammering an already-failing host at a fixed interval.
 * @param {number} attemptNumber - The attempt that just failed (1 for the first).
 */
export const adScriptRetryDelayMs = (attemptNumber: number): number =>
  attemptNumber * 750;
