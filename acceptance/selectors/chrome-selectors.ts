import { figmaCopy } from "./figma-copy.ts";

// Accessible names for the frame shared by every screen, and for the
// destinations a visitor reaches when a path or a render fails. Exact
// strings from figma-copy.ts (approved on Issue #97).
export const chromeSelectors = {
  siteHeader: figmaCopy.wordmark,
  attribution: figmaCopy.attribution,
  notFoundHeading: figmaCopy.notFoundHeading,
  backToGenerator: figmaCopy.backToTop,
} as const;

// A path no route claims. Written as a literal so the test states what it
// requests rather than computing it.
export const unknownPath = "/this-path-does-not-exist";
