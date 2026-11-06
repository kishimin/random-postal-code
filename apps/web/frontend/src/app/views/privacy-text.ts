/**
 * Japanese strings the privacy and attribution disclosure (Issue #10) shows.
 *
 * ui-design.md section 12 leaves the exact copy to this Issue; the MVP ships
 * Japanese only (section 9), so there is no locale to select between.
 *
 * The page takes Figma's four section headings (node 46:165, Issue #97), and
 * the sentences under them are the application's own accurate disclosure,
 * moved under the matching heading (owner decision on Issue #97,
 * https://github.com/kishimin/random-postal-code/issues/97#issuecomment-6670298264).
 * Figma's fifth heading, "5. お問い合わせ", is not in the MVP: a contact
 * section is V2 work (Issue #105). design.md section 8 still requires the
 * disclosure to tell what Zipnami itself stores (sections 1 and 4) from what
 * third-party services process (sections 2 and 3).
 */
export type PrivacySection = {
  /** The id its heading carries, which names the section's region. */
  readonly headingId: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
};

/*
 * 1. 取得する情報: design.md section 8 ("the absence of location
 * collection") and section 7 ("The Zipnami API neither receives nor stores
 * advertising identifiers"). AdSense may still set its own identifiers
 * client-side, which is why `googleAdSense` below says so explicitly rather
 * than leaving a reader to infer no advertising identifier exists anywhere
 * from the server-scoped denial here.
 */
const collectedInformation: PrivacySection = {
  headingId: "privacy-collected-information-heading",
  heading: "1. 取得する情報",
  paragraphs: [
    "Zipnamiは位置情報を取得しません。",
    "Zipnamiは独自の利用者識別子を発行しません。",
    "広告配信のための識別子をサーバーに保存することはありません。",
  ],
};

/*
 * 2. 利用目的: the embedded Google Map (design.md section 2).
 *
 * `googleMaps` is worded to match what this codebase actually does today
 * rather than the finished product. It names what reaches Google and when:
 * the embed requests the selected address only once the map region scrolls
 * into view (`AddressMap.tsx`), and the external link hands the address to
 * Google Maps itself. It said "not yet implemented" until Issue #8 shipped
 * the embed, which Codex review on that PR flagged as understating it.
 */
const purposeOfUse: PrivacySection = {
  headingId: "privacy-purpose-of-use-heading",
  heading: "2. 利用目的",
  paragraphs: [
    "選択した住所を地図に表示するため、Google Maps（Maps Embed API）を利用しています。地図の領域が画面に表示されると、選択した住所がGoogleへ送信され、Googleのサーバーから地図が読み込まれます。Google側の設定により、お使いのブラウザにCookieが保存される場合があります。「Googleマップで開く」を選ぶと、その住所でGoogleマップのサイトを開きます。",
  ],
};

/*
 * 3. 広告とアクセス解析: design.md section 2 lists Google AdSense and
 * consent handling as MVP scope. The consent platform is Google Privacy &
 * messaging (Issue #39; design.md section 12), so `consent` names it.
 *
 * `googleAnalytics*` (Issue #92) disclose what the visit measurement sends,
 * the `_ga` cookies, how the consent regions behave, and how to opt out. They
 * state the data design.md section 7 lists, and say the measurement is
 * Google's, not Zipnami's, like the services around them.
 *
 * `consent` describes what Google's own AdSense tag does once the "European
 * regulations" message is published in the AdSense account, which
 * docs/deployment.md makes part of production setup. Nothing in this codebase
 * gates or downgrades ad requests itself (`AdSlot.tsx` pushes to
 * `adsbygoogle` and leaves the decision to the platform), so the sentence is
 * true only once that message is published. The release review in design.md
 * section 12 confirms it.
 */
const advertisingAndAnalytics: PrivacySection = {
  headingId: "privacy-advertising-and-analytics-heading",
  heading: "3. 広告とアクセス解析",
  paragraphs: [
    "広告の配信にはGoogle AdSenseを利用しています。AdSense側の設定により、お使いのブラウザに広告用の識別子やCookieが保存される場合があります。",
    "アクセス状況の把握にはGoogle Analyticsを利用しています。閲覧したページ、参照元、お使いの端末の種類、おおよその地域といったアクセス情報がGoogleへ送信されます。Zipnamiが独自のイベントを送信することはありません。計測のため、Googleがお使いのブラウザに_gaなどのCookieを保存する場合があります。",
    "欧州経済領域（EEA）、英国、スイスからのアクセスでは、Googleの同意管理プラットフォーム（プライバシーとメッセージ）で同意が得られるまで、Cookieを保存せず、個人を特定しない範囲の情報のみをGoogleへ送信します。それ以外の地域からのアクセスは、同意を求めずに計測します。",
    "計測を望まない場合は、同意メッセージで同意しないか、Googleが提供するGoogle Analyticsオプトアウトアドオンをブラウザに導入することで、オプトアウトできます。",
    "欧州経済領域（EEA）、英国、スイスからのアクセスには、Googleの同意管理プラットフォーム（プライバシーとメッセージ）が同意を求めるメッセージを表示します。パーソナライズ広告に同意しない場合や同意が得られる前は、パーソナライズされていない広告または制限付き広告が表示されます。選択はこのメッセージからいつでも変更できます。",
  ],
};

/*
 * 4. 履歴: design.md section 8 ("browser-local history").
 *
 * The sentence states what the code does today. It said "not yet
 * implemented" until Issue #7 shipped the history, and the deployed /privacy
 * kept saying so after the deployed site already kept history (Issue #21).
 * The history is the visitor's own browser storage (`localStorage`), which
 * the Worker never receives, so the sentence names both where it lives and
 * where it does not go.
 */
const history: PrivacySection = {
  headingId: "privacy-history-heading",
  heading: "4. 履歴",
  paragraphs: [
    "生成した郵便番号の履歴は、お使いのブラウザ内にのみ保存し、サーバーには送信しません。",
  ],
};

/** The page's sections, in Figma's order. */
export const privacySections: readonly PrivacySection[] = [
  collectedInformation,
  purposeOfUse,
  advertisingAndAnalytics,
  history,
];
