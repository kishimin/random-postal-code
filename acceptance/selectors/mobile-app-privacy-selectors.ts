/*
 * What the Issue #20 privacy policy test looks for on /privacy.
 *
 * The Google Play listing links one privacy policy URL, and the policy behind
 * it has to describe the Android app, not only the Web site. Each expression
 * fixes the subject and what has to be said about it within one sentence
 * (`[^。]` stops at the full stop); the rest of the wording is the page's own,
 * as with privacy-selectors.ts (ADR-0054).
 */
export const mobileAppPrivacySelectors = {
  /** The policy names the Android app at all. */
  androidApp: /Android/,

  /** The app's banner is Google AdMob, which the Web page does not use. */
  adMob: /AdMob/,

  /** The advertising ID the AdMob SDK reads on the device. */
  advertisingId: /(?:アプリ|AdMob)[^。]*広告ID|広告ID[^。]*(?:アプリ|AdMob)/,

  /** The app asks for consent before ads (UMP), in the same sentence. */
  appConsent: /(?:アプリ|AdMob)[^。]*同意|同意[^。]*(?:アプリ|AdMob)/,

  /** The app's history stays on the device it was made on. */
  appHistoryOnDevice:
    /アプリ[^。]*履歴[^。]*(?:端末|デバイス)|アプリ[^。]*(?:端末|デバイス)[^。]*履歴|履歴[^。]*アプリ[^。]*(?:端末|デバイス)/,
} as const;
