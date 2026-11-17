import type { GenerationFailure } from "./random-postal-code";

/**
 * The generator screen's Japanese copy. It is the Web generator's
 * (apps/web/frontend/src/features/postal-generator/site-text.ts), so both
 * clients name the same action and explain a failure the same way.
 */
export const generatorText = {
  brand: "ZIPNAMI",
  intro: "日本全国から、ひとつの郵便番号を選びます。",
  startAction: "ランダム生成する",
  regenerateAction: "もう一度、波に乗る",
  retryAction: "再試行する",
  loadingAction: "郵便番号を生成しています",
  currentResultLabel: "今回の結果",
  resultHeading: "波が運んできた場所",
  mysteryCode: "〒 ???-????",
  // Read aloud instead of the bare 〒 and digits.
  postalCodeLabel: (displayed: string) => `郵便番号 ${displayed}`,
  resultAnnouncement: (displayed: string) =>
    `郵便番号 ${displayed} を生成しました`,
  failureHeading: "場所を取得できませんでした",
  failure: {
    offline: "通信状態を確認して、もう一度お試しください。",
    "service-unavailable":
      "サーバーが混み合っています。しばらくしてからもう一度お試しください。",
    "invalid-response":
      "予期しない応答を受信しました。もう一度お試しください。",
    unexpected:
      "サーバーで問題が発生しました。しばらくしてからもう一度お試しください。",
  } satisfies Record<GenerationFailure, string>,
  historyHeading: "生成の履歴",
  historyEmpty: "生成した郵便番号がここに並びます。",
  // Names one entry of the history after the postal code it holds.
  historyEntryLabel: (displayed: string) => `履歴 ${displayed}`,
  // The Web's name for the same action (ui-design.md section 5.3).
  mapLinkLabel: (address: string) => `${address}をGoogle マップで開く`,
  mapFailureHeading: "地図を開けませんでした",
  mapFailureBody:
    "Google マップを開けるアプリやブラウザが見つかりません。住所はこの画面の表示をご確認ください。",
  adRegionLabel: "広告",
  infoLink: "Zipnami について",
} as const;
