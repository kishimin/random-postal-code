import { figmaCopy } from "./figma-copy.ts";

/*
 * What the Issue #10 acceptance test locates the privacy and attribution
 * disclosure by.
 *
 * The sections, the links, and the credit are found by their exact words
 * (figma-copy.ts, approved on Issue #97). The statements inside the sections
 * are the page's body, which stays the application's own accurate text, so
 * each statement expression fixes only what the disclosure has to say — the
 * subject and, where the criterion is about a denial, its negative form. The
 * sentence around it stays the implementation's. Holding them here rather than
 * in the Page Object keeps a copy change to one edit (ADR-0054); the MVP ships
 * Japanese only (ui-design.md section 9), so there is no locale to select
 * between.
 */
export const privacySelectors = {
  /*
   * The four sections the disclosure is divided into, by Figma's headings.
   *
   * Each is held as a separately named region rather than as one page of
   * prose, so that where a statement sits is something a test can read: a
   * region is how a section reaches a screen reader (ui-design.md section 8),
   * which is why the test may depend on it at all (ADR-0012). Each region is
   * found by its heading's exact words.
   *
   * This replaces the earlier split into "data stored by Zipnami" and "data
   * processed by third parties", and the contact link that came after them:
   * the owner chose Figma's headings and moved contact to V2 (Issue #105),
   * approved as an acceptance-test rewrite on Issue #97,
   * https://github.com/kishimin/random-postal-code/issues/97#issuecomment-6670298264.
   */
  sectionHeadings: figmaCopy.privacySections,

  /*
   * The third parties the disclosure has to name.
   *
   * Each is a service this product actually uses — design.md sections 2 and 7
   * — so naming them is a statement about the real integration rather than
   * boilerplate. Which script is loaded for consent is still unselected
   * (design.md section 12 routes the AdSense and consent configuration to
   * human review), so consent is matched as a subject the disclosure covers,
   * not as a named vendor.
   */
  googleMaps: /Google\s*(?:Maps|マップ)/i,
  googleAdSense: /AdSense|アドセンス/i,
  consent: /同意|コンセント|Consent/i,

  /*
   * History kept in the visitor's own browser (design.md section 6.2).
   *
   * Both halves are required of one sentence: "履歴" alone would be satisfied
   * by a page that never says where the history lives, which is the single
   * fact this criterion exists to publish.
   */
  browserLocalHistory:
    /履歴[^。]*(?:ブラウザ|端末)|(?:ブラウザ|端末)[^。]*履歴/,

  /*
   * The three denials.
   *
   * Each expression fixes the subject and a negative ending in the same
   * sentence — `[^。]` stops at the full stop, so a denial cannot be assembled
   * out of two unrelated sentences. The verb in between is the
   * implementation's, because "収集しません", "取得していません", and
   * "取得することはありません" are the same statement.
   *
   * What these hold is that the page states it. Whether the product actually
   * behaves this way is not held here and could not be: proving an absence at
   * runtime would mean enumerating every way an identifier could be issued or
   * stored, and a check that misses one still passes (ADR-0019). The Issue's
   * own criterion asks that the disclosure "states" these, and the accuracy of
   * what it states is a human review (design.md section 12).
   */
  noLocationCollection:
    /位置情報[^。]*(?:しません|していません|ありません|ない)/,
  noOwnUserIdentifier:
    /(?:独自|自前|Zipnami)[^。]*(?:識別子|ID)[^。]*(?:しません|していません|ありません|ない)/i,
  noStoredAdvertisingIdentifier:
    /広告[^。]*(?:識別子|ID)[^。]*(?:しません|していません|ありません|ない)/i,

  /*
   * The link that leads into the disclosure from the rest of the application.
   *
   * "Publicly reachable from the Web application" is about arriving there
   * without knowing the address, so the link is located by the words a visitor
   * would look for rather than by where the frame happens to put it.
   */
  disclosureLink: figmaCopy.privacyLink,

  /*
   * The Japan Post credit: Figma's footer sentence, which is the one that
   * keeps the product from presenting the addresses as its own.
   */
  japanPostCredit: figmaCopy.attribution,
} as const;

/** One of the disclosure's section headings. */
export type PrivacySectionHeading =
  (typeof privacySelectors.sectionHeadings)[keyof typeof privacySelectors.sectionHeadings];
