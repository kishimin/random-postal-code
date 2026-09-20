// Accessible names the acceptance tests locate by. Kept out of the page objects
// so a copy change is one edit here rather than one per locator.
export const shellSelectors = {
  siteName: /Zipnami/,
  privacyHeading: /プライバシー/,
} as const;

// ui-design.md section 10 lists 320px as the narrowest viewport to verify.
export const narrowPhoneViewport = { width: 320, height: 640 } as const;
