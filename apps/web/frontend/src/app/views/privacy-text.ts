/**
 * Japanese strings the privacy and attribution disclosure (Issue #10) shows.
 *
 * ui-design.md section 12 leaves the exact copy to this Issue; the MVP ships
 * Japanese only (section 9), so there is no locale to select between.
 *
 * design.md section 8 requires the disclosure to distinguish what Zipnami
 * itself stores from what third-party services process, so the strings below
 * are grouped the same way rather than as one flat list.
 */
export const privacyText = {
  /**
   * The Zipnami-storage section: design.md section 8 ("browser-local
   * history, the absence of location collection") and section 7 ("The
   * Zipnami API neither receives nor stores advertising identifiers").
   */
  firstParty: {
    heading: "Zipnamiが保存する情報",
  },

  /**
   * The third-party section: design.md section 2 lists an embedded Google
   * Map, Google AdSense, and consent handling as MVP scope.
   */
  thirdParty: {
    heading: "第三者サービスが処理する情報",
  },
} as const;
