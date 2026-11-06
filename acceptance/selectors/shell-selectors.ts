import { figmaCopy } from "./figma-copy.ts";

// Accessible names the acceptance tests locate by. Kept out of the page objects
// so a copy change is one edit here rather than one per locator.
export const shellSelectors = {
  // The document title still names the product; it is not Figma copy, and
  // ui-design.md section 8 asks only that it name the screen.
  siteName: /Zipnami/,
  siteHeader: figmaCopy.wordmark,
  privacyHeading: figmaCopy.privacyHeading,
  privacyLink: figmaCopy.privacyLink,
} as const;

// ui-design.md section 10 lists 320px as the narrowest viewport to verify.
export const narrowPhoneViewport = { width: 320, height: 640 } as const;
