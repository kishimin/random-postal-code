/*
 * Strings the frame shows on every screen.
 *
 * Held in one module because the global error screen repeats the frame without
 * the router, and two copies of the attribution would drift apart. The privacy
 * page's own wording belongs to Issue #10.
 */
export const siteText = {
  name: "Zipnami",
  attribution:
    "郵便番号データは日本郵便株式会社が公開するデータを利用しています。",
  privacyLabel: "プライバシーポリシー",
  backToGenerator: "トップへ戻る",
} as const;
