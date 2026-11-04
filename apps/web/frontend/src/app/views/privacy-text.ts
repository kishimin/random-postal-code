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
   * `browserLocalHistory` states what the code does today, like the
   * sentences below. It said "not yet implemented" until Issue #7 shipped
   * the history, and the deployed /privacy kept saying so after the deployed
   * site already kept history (Issue #21). The history is the visitor's own
   * browser storage (`localStorage`), which the Worker never receives, so the
   * sentence names both where it lives and where it does not go.
   */
  firstParty: {
    heading: "Zipnamiが保存する情報",
    browserLocalHistory:
      "生成した郵便番号の履歴は、お使いのブラウザ内にのみ保存し、サーバーには送信しません。",
    noLocationCollection: "Zipnamiは位置情報を取得しません。",
    noOwnUserIdentifier: "Zipnamiは独自の利用者識別子を発行しません。",
    noStoredAdvertisingIdentifier:
      "広告配信のための識別子をサーバーに保存することはありません。",
  },

  /**
   * The third-party section: design.md section 2 lists an embedded Google
   * Map, Google AdSense, and consent handling as MVP scope. The consent
   * platform is Google Privacy & messaging (Issue #39; design.md section 12),
   * so `consent` names it.
   *
   * `googleAnalytics*` (Issue #92) disclose what the visit measurement
   * sends, the `_ga` cookies, how the consent regions behave, and how to
   * opt out. They state the data design.md section 7 lists, and say the
   * measurement is Google's, not Zipnami's, like the services around them.
   *
   * `googleMaps`, `googleAdSense`, and `consent` are worded to match what
   * this codebase actually does today rather than the finished product.
   * `googleMaps` names what reaches Google and when: the embed requests the
   * selected address only once the map region scrolls into view
   * (`AddressMap.tsx`), and the external link hands the address to Google
   * Maps itself. It said "not yet implemented" until Issue #8 shipped the
   * embed, which Codex review on that PR flagged as understating it.
   * `consent` describes what Google's own AdSense tag does once the
   * "European regulations" message is published in the AdSense account,
   * which docs/deployment.md makes part of production setup. Nothing in
   * this codebase gates or downgrades ad requests itself (`AdSlot.tsx`
   * pushes to `adsbygoogle` and leaves the decision to the platform), so the
   * sentence is true only once that message is published. The release
   * review in design.md section 12 confirms it. AdSense may still set its
   * own identifiers client-side, which is why `googleAdSense` says so explicitly
   * rather than leaving a reader to infer no advertising identifier exists
   * anywhere from the server-scoped denial in
   * `firstParty.noStoredAdvertisingIdentifier`.
   */
  thirdParty: {
    heading: "第三者サービスが処理する情報",
    googleMaps:
      "選択した住所を地図に表示するため、Google Maps（Maps Embed API）を利用しています。地図の領域が画面に表示されると、選択した住所がGoogleへ送信され、Googleのサーバーから地図が読み込まれます。Google側の設定により、お使いのブラウザにCookieが保存される場合があります。「Googleマップで開く」を選ぶと、その住所でGoogleマップのサイトを開きます。",
    googleAdSense:
      "広告の配信にはGoogle AdSenseを利用しています。AdSense側の設定により、お使いのブラウザに広告用の識別子やCookieが保存される場合があります。",
    googleAnalytics:
      "アクセス状況の把握にはGoogle Analyticsを利用しています。閲覧したページ、参照元、お使いの端末の種類、おおよその地域といったアクセス情報がGoogleへ送信されます。Zipnamiが独自のイベントを送信することはありません。計測のため、Googleがお使いのブラウザに_gaなどのCookieを保存する場合があります。",
    googleAnalyticsConsent:
      "欧州経済領域（EEA）、英国、スイスからのアクセスでは、Googleの同意管理プラットフォーム（プライバシーとメッセージ）で同意が得られるまで、Cookieを保存せず、個人を特定しない範囲の情報のみをGoogleへ送信します。それ以外の地域からのアクセスは、同意を求めずに計測します。",
    googleAnalyticsOptOut:
      "計測を望まない場合は、同意メッセージで同意しないか、Googleが提供するGoogle Analyticsオプトアウトアドオンをブラウザに導入することで、オプトアウトできます。",
    consent:
      "欧州経済領域（EEA）、英国、スイスからのアクセスには、Googleの同意管理プラットフォーム（プライバシーとメッセージ）が同意を求めるメッセージを表示します。パーソナライズ広告に同意しない場合や同意が得られる前は、パーソナライズされていない広告または制限付き広告が表示されます。選択はこのメッセージからいつでも変更できます。",
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
