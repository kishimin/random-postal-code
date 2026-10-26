/*
 * What the Issue #7 acceptance test locates the history by.
 *
 * ui-design.md section 12 leaves the exact Japanese copy to the Issue that
 * builds the screen, so this fixes only the word a visitor recognises the
 * region by, not the sentence around it. Held here rather than in the Page
 * Object so a copy change is one edit (ADR-0054); the MVP ships Japanese only
 * (ui-design.md section 9), so there is no locale to select between.
 */
export const historySelectors = {
  // ui-design.md section 8 requires a heading over the history region, which is
  // also what separates history from the current result for a visitor reading
  // the page top to bottom.
  historyHeading: /履歴/,
} as const;

/*
 * The control that reveals the addresses a collapsed history entry is hiding.
 *
 * ui-design.md section 5.4 requires "an explicit expand control" but leaves its
 * label to this Issue, and section 5.4 also makes collapsing conditional on
 * constrained space -- so an entry may legitimately have no such control at
 * all. `aria-expanded` is how a disclosure control identifies itself whatever
 * it is called: accessibility semantics rather than page structure, which is
 * why an acceptance test may depend on it (ADR-0012).
 */
export const expandControlSelector = "[aria-expanded]";
