/*
 * What the Issue #105 acceptance test locates the privacy page's contact
 * section by.
 *
 * The heading is Figma's fifth section heading on node 46:165, the one the
 * Issue #97 selectors left out while contact was V2 work. Figma draws no link
 * under it, so the link's name is the contract's (ui-design.md, "Where Figma
 * is not taken literally"), not Figma's.
 *
 * Kept in its own file rather than added to `figma-copy.ts` or
 * `privacy-selectors.ts`: both are committed acceptance infrastructure and
 * locked by the ATDD guard.
 */
export const privacyContactSelectors = {
  sectionHeading: "5. お問い合わせ",

  linkName: "お問い合わせフォーム",

  /*
   * The responder URL of the contact form created with the Forms API,
   * recorded on Issue #105:
   * https://github.com/kishimin/random-postal-code/issues/105#issuecomment-6904686822
   * Anyone may open it to answer the form, so it is not a secret.
   */
  formUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSej3EUlVYPDsE6AzzILNLYqqu1kJlDWBJE-vxuNjk8jzqjSnQ/viewform",

  /*
   * The two things the section has to state. Each is held to one sentence —
   * `[^。]` stops at the full stop — so it cannot be assembled out of two
   * unrelated sentences, and the wording around the subject stays the
   * implementation's.
   *
   * - The form is a Google service: "Google" and "フォーム" in one sentence.
   * - How what is entered is used: what is entered (入力) and what it is used
   *   for (問い合わせ) in one sentence that says it is used (利用 or 使用).
   */
  formIsGoogleService: /Google[^。]*フォーム/,
  howInputIsUsed: /入力[^。]*問い合わせ[^。]*(?:利用|使用)/,
} as const;
