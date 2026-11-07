/*
 * Strings the frame shows on every screen.
 *
 * Held in one module because the global error screen repeats the frame without
 * the router, and two copies of the attribution would drift apart. The privacy
 * page's own wording belongs to Issue #10.
 */
export const siteText = {
  name: "Zipnami",
  // The wordmark is Figma's literal (#2:16), so the header link's accessible
  // name is the word a visitor reads.
  wordmark: "ZIPNAMI",
  attribution:
    "郵便番号データは日本郵便株式会社が公開するデータを利用しています。",
  privacyLabel: "プライバシーポリシー",
  // The footer's link on /privacy itself (owner decision on Issue #112).
  homeLabel: "ホームに戻る",
  backToGenerator: "トップへ戻る",
  // The header's tagline and the footer's attribution, both fixed by the
  // Figma frames (ui-design.md section 9.2).
  tagline: "日本のどこかへ、波まかせ。",
  copyright: "© kishimin 2026",
} as const;

/**
 * Builds a document title that names one screen while every tab still
 * carries the product name (WCAG 2.4.2, Page Titled).
 * @param {string} [pageName] - The current screen's own name. Omitted for the
 * generator, which is the product's home screen and needs no name of its
 * own ahead of it.
 */
export const pageTitle = (pageName?: string): string =>
  pageName ? `${pageName} | ${siteText.name}` : siteText.name;
