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
   *
   * `browserLocalHistory` states the current status rather than the
   * finished product's: Issue #7 (the history feature itself) is still
   * open, and neither `GeneratorView` nor `useGenerator` writes a
   * generated result anywhere but React state, so a present-tense claim
   * that history is already saved in the browser would misstate what this
   * codebase does today (a Codex review on this PR caught this the same
   * way CR-001 caught the consent sentence below).
   */
  firstParty: {
    heading: "Zipnamiが保存する情報",
    browserLocalHistory:
      "生成した郵便番号の履歴をブラウザに保存する機能は、本サービスでは現時点で未実装です。実装後もサーバーには送信せず、ブラウザ内にのみ保存します。",
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
   *
   * `googleMaps`, `googleAdSense`, and `consent` are worded to match what
   * this codebase actually does today rather than the finished product.
   * `googleMaps` states that the feature is not yet implemented: Issue #8
   * is still open and no Maps component, SDK, or request path exists on
   * this branch, so a present-tense "Zipnami uses Google Maps" would
   * misstate current third-party processing (flagged by Codex review on
   * this PR, the same class of finding as CR-001/the history claim above).
   * No code here gates an ad request on consent (`AdSlot.tsx` pushes to
   * `adsbygoogle` unconditionally), so `consent` states that a mechanism is
   * not yet implemented instead of claiming one already runs — Issue #10's
   * own Out of scope forbids a claim the SDK configuration does not
   * support. AdSense may still set its own identifiers client-side even
   * without a consent gate, which is why `googleAdSense` says so explicitly
   * rather than leaving a reader to infer no advertising identifier exists
   * anywhere from the server-scoped denial in
   * `firstParty.noStoredAdvertisingIdentifier`.
   */
  thirdParty: {
    heading: "第三者サービスが処理する情報",
    googleMaps:
      "選択した住所の地図表示にGoogle Mapsを利用する機能は、本サービスでは現時点で未実装です。一般公開までに導入します。",
    googleAdSense:
      "広告の配信にはGoogle AdSenseを利用しています。AdSense側の設定により、お使いのブラウザに広告用の識別子やCookieが保存される場合があります。",
    consent:
      "広告表示にあたり同意の取得が必要な地域向けの同意管理の仕組みは、本サービスでは現時点で未導入です。一般公開までに導入します。",
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
