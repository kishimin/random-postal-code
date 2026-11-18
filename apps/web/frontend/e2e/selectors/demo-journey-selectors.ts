/*
 * What the v1.0.0 demo recording (Issue #132) locates the deployed site by.
 *
 * The generate action reads differently before and after the first result
 * (Issue #97), so it is matched by either label, as whole strings. The guide
 * page shown is 使い方, the one that explains the screen the video has just
 * shown.
 */
export const demoJourneySelectors = {
  generateAction: /^(?:ランダム生成する|もう一度、波に乗る)$/,
  copyAction: /^郵便番号をコピー$/,
  guideNavigation: "ガイド",
  guideLink: "使い方",
  backToTop: "トップへ戻る",
} as const;
