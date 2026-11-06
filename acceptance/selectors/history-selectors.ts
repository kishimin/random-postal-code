import { figmaCopy } from "./figma-copy.ts";

/*
 * What the Issue #7 acceptance test locates the history by: the exact Figma
 * words from figma-copy.ts (approved on Issue #97).
 */
export const historySelectors = {
  // ui-design.md section 8 requires a heading over the history region, which is
  // also what separates history from the current result for a visitor reading
  // the page top to bottom.
  historyHeading: figmaCopy.historyHeading,
  // The control that opens the history list (Figma). Once open, an entry
  // shows every address it holds.
  expandHistory: figmaCopy.expandHistory,
} as const;
