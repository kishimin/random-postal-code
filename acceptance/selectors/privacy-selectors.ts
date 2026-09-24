/*
 * What the Issue #10 acceptance test locates the privacy and attribution
 * disclosure by.
 *
 * ui-design.md section 12 leaves the exact Japanese copy and the contact
 * destination to the Issue that builds the screen, so each expression below
 * fixes only what a visitor needs in order to recognise the disclosure — the
 * subject and, where the criterion is about a denial, its negative form. The
 * sentence around it stays the implementation's. Holding them here rather than
 * in the Page Object keeps a copy change to one edit (ADR-0054); the MVP ships
 * Japanese only (ui-design.md section 9), so there is no locale to select
 * between.
 */
export const privacySelectors = {
  /*
   * The two sections the disclosure is divided into.
   *
   * "It distinguishes data stored by Zipnami from data processed by
   * third-party services" is a criterion about structure, not about wording,
   * so it is held as two separately named regions rather than as one page of
   * prose that happens to mention both. A region is how that structure reaches
   * a screen reader (ui-design.md section 8), which is why the test may depend
   * on it at all (ADR-0012).
   *
   * The two expressions are written so that one accessible name cannot satisfy
   * both: the first-party name has to join Zipnami to what it keeps, and the
   * third-party name has to say that the processor is somebody else.
   */
  firstPartySectionLabel: /Zipnami.*(?:保存|記録)/,
  thirdPartySectionLabel: /第三者|サードパーティ|外部サービス/,

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
  browserLocalHistory: /履歴[^。]*(?:ブラウザ|端末)|(?:ブラウザ|端末)[^。]*履歴/,

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

  /* How a visitor recognises the contact affordance. */
  contactLabel: /(?:お)?問(?:い)?合(?:わ)?せ|連絡先|Contact/i,

  /*
   * The link that leads into the disclosure from the rest of the application.
   *
   * "Publicly reachable from the Web application" is about arriving there
   * without knowing the address, so the link is located by the words a visitor
   * would look for rather than by where the frame happens to put it.
   */
  disclosureLink: /プライバシー/,

  /*
   * The Japan Post credit.
   *
   * "日本郵便" alone would be matched by a page that merely mentions the
   * company, so the expression also requires the word that makes it a credit:
   * the data is published or provided by them. That is the same sentence which
   * keeps the product from presenting the addresses as its own.
   */
  japanPostCredit: /日本郵便[^。]*(?:公開|提供)/,
} as const;

/*
 * What a usable contact destination looks like.
 *
 * ui-design.md section 12 leaves the destination itself open, so this fixes
 * only that the link leads somewhere a visitor can actually reach — a mail
 * address or a page on the web. Without it, `href="#"` would satisfy "provides
 * a contact method".
 */
export const contactDestinationPattern = /^(?:mailto:|https:\/\/)\S/;
