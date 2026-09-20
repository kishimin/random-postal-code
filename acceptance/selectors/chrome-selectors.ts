// Accessible names for the frame shared by every screen, and for the
// destinations a visitor reaches when a path or a render fails.
export const chromeSelectors = {
  siteHeader: /Zipnami/,
  attribution: /日本郵便/,
  notFoundHeading: /ページが見つかりません/,
  backToGenerator: /トップへ戻る/,
} as const;

// A path no route claims. Written as a literal so the test states what it
// requests rather than computing it.
export const unknownPath = "/this-path-does-not-exist";
