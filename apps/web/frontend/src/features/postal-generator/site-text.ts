/**
 * Japanese strings the generator screen shows. ui-design.md section 12
 * leaves the exact copy to this Issue; the MVP ships Japanese only (section
 * 9), so there is no locale to select between.
 */
export const postalGeneratorText = {
  // The start screen's copy comes from the Figma nodes (ui-design.md section
  // 9.1). Figma writes three widths of it: the headline and the body differ
  // between phone, tablet, and desktop, so each width has its own string and
  // the layout shows the one that fits. Lines are arrays because a line
  // break is part of how Figma sets the headline.
  eyebrow: "RANDOM POSTCODE JOURNEY",
  startHeadline: {
    compact: ["知らない場所へ、", "波に乗って。"],
    regular: ["知らない場所へ、", "郵便番号の波に乗って。"],
  },
  startBody: {
    compact: ["日本全国から、ひとつの郵便番号を選びます。"],
    regular: ["日本全国からひとつの郵便番号をランダムに選びます。"],
    wide: [
      "ボタンを押すと、日本全国からひとつの郵便番号を選びます。",
      "目的地を決めない、小さな旅を始めましょう。",
    ],
  },
  mysteryCode: "〒 ???-????",
  mysteryNote: "次に出会う場所は、まだわかりません。",
  failureHeading: "場所を取得できませんでした",
  resultEyebrow: "TODAY'S DESTINATION",
  postalCodeLabel: "郵便番号",
  // "この郵便番号に" only fits beside the wide layout; the narrower Figma
  // frames say just "対応する住所 N件".
  addressCountPrefix: "この郵便番号に",
  addressCount: (count: number) => `対応する住所 ${count}件`,
  // Figma labels the one generate action by state: before a result (#2:13),
  // after one (#2:33), and while the API error shows (#27:78).
  startActionLabel: "ランダム生成する",
  regenerateActionLabel: "もう一度、波に乗る",
  retryActionLabel: "再試行する",
  copyLabel: "郵便番号をコピー",
  resultHeading: "波が運んできた場所",
  loadingAnnouncement: "郵便番号を生成しています",
  resultAnnouncement: (displayedPostalCode: string) =>
    `郵便番号 ${displayedPostalCode} を生成しました`,
  // One message per UiError kind (generator-state.ts) so a visitor is told
  // something that actually matches what went wrong, rather than one shared
  // sentence that reads the same whether their connection dropped or the
  // server had a problem.
  failureAnnouncement: {
    offline: "通信状態を確認して、もう一度お試しください。",
    "service-unavailable":
      "サーバーが混み合っています。しばらくしてからもう一度お試しください。",
    "invalid-response":
      "予期しない応答を受信しました。もう一度お試しください。",
    unexpected:
      "サーバーで問題が発生しました。しばらくしてからもう一度お試しください。",
  },
  copySuccessAnnouncement: "郵便番号をコピーしました",
  copyFailureAnnouncement: "コピーできませんでした。もう一度お試しください。",
} as const;
