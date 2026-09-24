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
    browserLocalHistory:
      "生成した郵便番号の履歴は、お使いのブラウザにのみ保存され、サーバーには送信されません。",
    noLocationCollection: "Zipnamiは位置情報を取得しません。",
    noOwnUserIdentifier: "Zipnamiは独自の利用者識別子を発行しません。",
    noStoredAdvertisingIdentifier:
      "広告配信のための識別子をサーバーに保存することはありません。",
  },

  /**
   * The third-party section: design.md section 2 lists an embedded Google
   * Map, Google AdSense, and consent handling as MVP scope. Which script is
   * loaded for consent is still unselected (section 12 routes the AdSense
   * and consent configuration to human review before release), so consent is
   * named as a subject the disclosure covers, not as a specific vendor.
   */
  thirdParty: {
    heading: "第三者サービスが処理する情報",
    googleMaps: "選択した住所の地図表示にはGoogle Mapsを利用しています。",
    googleAdSense: "広告の配信にはGoogle AdSenseを利用しています。",
    consent:
      "広告表示にあたり同意の取得が必要な地域では、所定の同意管理の仕組みを使用します。",
  },

  /*
   * The contact affordance. ui-design.md section 12 leaves the destination
   * itself open; the GitHub Issues address is used because it is a real,
   * already-published destination for this project (design.md section 1),
   * not one invented for this screen.
   */
  contactLabel: "お問い合わせ",
  contactHref: "https://github.com/kishimin/random-postal-code/issues",
} as const;
