import type { Address } from "@zipnami/shared";

/*
 * Every word the acceptance tests find a control, a link, a heading, or a
 * status by, held as the exact string a visitor reads.
 *
 * The owner approved finding each one by its exact Figma wording instead of
 * by words chained into a regular expression, so a wrong label fails rather
 * than slipping through an alternative (Issue #97,
 * https://github.com/kishimin/random-postal-code/issues/97#issuecomment-6657103050).
 * Figma is the source of truth for design, and WCAG 2.2 AA wins where the two
 * disagree (issuecomment-6657075269); the four places that are not a Figma
 * literal are recorded in issuecomment-6657325904 and marked below.
 *
 * Read from Figma file `40UjUstDqllFYEaQ31J8L0` on 2026-11-05. Each entry
 * names the node it came from, so a reader can check it against the design
 * without trusting this file. Holding them in one place keeps a copy change
 * to one edit (ADR-0054).
 *
 * A line break Figma writes inside a text node is layout, not copy: an
 * accessible name and a text match collapse it, so the strings below join
 * those lines with nothing between them.
 */
export const figmaCopy = {
  // Header (#2:3 and its copies on every frame). The "このアプリについて"
  // link was removed from Figma, so the header has no other link.
  wordmark: "ZIPNAMI",
  tagline: "日本のどこかへ、波まかせ。",

  // Start screen headline: desktop and tablet (#2:7, #4:5), and mobile
  // (#6:6). The page's h1.
  startHeadline: {
    regular: "知らない場所へ、郵便番号の波に乗って。",
    compact: "知らない場所へ、波に乗って。",
  },
  // Start screen body: desktop (#2:8), tablet (#4:6), and mobile (#6:7).
  startBody: {
    wide: "ボタンを押すと、日本全国からひとつの郵便番号を選びます。目的地を決めない、小さな旅を始めましょう。",
    regular: "日本全国からひとつの郵便番号をランダムに選びます。",
    compact: "日本全国から、ひとつの郵便番号を選びます。",
  },

  // The generate action takes a different label in each state: before the
  // first result (#2:13, #27:70), after a result (#2:33, #6:33), and after
  // the API failed (#27:78).
  startAction: "ランダム生成する",
  regenerateAction: "もう一度、波に乗る",
  retryAction: "再試行する",

  // Result (#2:20, #4:16). The mobile result frame (#6:19) draws no such
  // headline, so there the heading is visually hidden but keeps this name:
  // the result section still needs its heading (WCAG 1.3.1, approved as one
  // of the four non-literal points).
  resultHeading: "波が運んできた場所",
  copyAction: "郵便番号をコピー", // #46:48, #46:100

  // Per address: the visible labels (Figma address rows). Their accessible
  // names carry the address as well -- see showOnMapName below.
  showOnMap: "地図に表示",
  openInGoogleMaps: "Google マップで開く",

  // History.
  historyHeading: "生成の履歴",
  expandHistory: "履歴を展開",

  // Advertising label. "広告掲載エリア" in the frame is the mock's
  // placeholder, not copy.
  advertisingLabel: "広告",

  // API error panel (#27:75, #27:76; mobile #27:96, #27:97).
  apiErrorHeading: "場所を取得できませんでした",
  apiErrorBody: "通信状態を確認して、もう一度お試しください。",

  // 404 (#27:107, #27:108, #27:110; mobile #27:118, #27:119).
  notFoundHeading: "ページが見つかりません",
  notFoundBody: "URLが正しいか確認するか、トップページへ戻ってください。",
  backToTop: "トップへ戻る",

  // Privacy page heading (#46:165). Its body stays the application's own
  // accurate text (approved decision 1), so it is not transcribed here.
  privacyHeading: "プライバシーポリシー",

  // Footer on every screen (#2:14 and its copies).
  privacyLink: "プライバシーポリシー",
  attribution:
    "郵便番号データは日本郵便株式会社が公開するデータを利用しています。",
  copyright: "© kishimin 2026",
} as const;

/**
 * An address as one string, the way its accessible names carry it.
 * @param address - One address of a result.
 */
const fullAddress = (address: Address) =>
  `${address.prefecture}${address.city}${address.town}`;

/**
 * The accessible name of the control that shows this address on the map.
 *
 * Figma's visible label is the same on every row, and WCAG 2.4.4 and
 * ui-design.md section 8 need each row's control told apart, so the name
 * puts the address in front of the visible label (2.5.3 Label in Name still
 * holds). AA over Figma, approved as one of the four non-literal points.
 * @param address - The address the control belongs to.
 */
export const showOnMapName = (address: Address) =>
  `${fullAddress(address)}を${figmaCopy.showOnMap}`;

/**
 * The accessible name of the link that opens this address in Google Maps,
 * for the same reason as showOnMapName.
 * @param address - The address the link belongs to.
 */
export const openInGoogleMapsName = (address: Address) =>
  `${fullAddress(address)}を${figmaCopy.openInGoogleMaps}`;

/*
 * Words Figma does not draw: statuses and announcements, the map's heading,
 * and the privacy page's own sections and contact link. Each is the
 * application's current wording, copied from the file named beside it, so a
 * test still finds it by the whole string rather than by a fragment.
 */
export const applicationCopy = {
  // apps/web/frontend/src/features/postal-generator/site-text.ts
  loadingAnnouncement: "郵便番号を生成しています",
  copySuccessAnnouncement: "郵便番号をコピーしました",
  // What `503 DATA_UNAVAILABLE` is announced as. The offline failure reads
  // figmaCopy.apiErrorBody, which Figma does draw.
  serviceUnavailableAnnouncement:
    "サーバーが混み合っています。しばらくしてからもう一度お試しください。",

  // apps/web/frontend/src/features/maps/site-text.ts
  mapHeading: "地図",

  // apps/web/frontend/src/app/views/privacy-text.ts
  privacyFirstPartyHeading: "Zipnamiが保存する情報",
  privacyThirdPartyHeading: "第三者サービスが処理する情報",
  privacyContact: "お問い合わせ",
} as const;
