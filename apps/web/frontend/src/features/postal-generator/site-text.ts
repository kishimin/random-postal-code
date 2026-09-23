/**
 * Japanese strings the generator screen shows. ui-design.md section 12
 * leaves the exact copy to this Issue; the MVP ships Japanese only (section
 * 9), so there is no locale to select between.
 */
export const postalGeneratorText = {
  explanation: "ボタンを押すと、ランダムな郵便番号と住所を表示します。",
  generateLabel: "郵便番号を生成",
  copyLabel: "郵便番号をコピー",
  resultHeading: "生成結果",
  loadingAnnouncement: "郵便番号を生成しています",
  resultAnnouncement: (displayedPostalCode: string) =>
    `郵便番号 ${displayedPostalCode} を生成しました`,
  // One message per UiError kind (generator-state.ts) so a visitor is told
  // something that actually matches what went wrong, rather than one shared
  // sentence that reads the same whether their connection dropped or the
  // server had a problem.
  failureAnnouncement: {
    offline: "インターネット接続を確認してから、もう一度お試しください。",
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
