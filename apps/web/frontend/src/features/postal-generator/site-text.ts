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
  failureAnnouncement: "郵便番号の生成に失敗しました。もう一度お試しください。",
} as const;
