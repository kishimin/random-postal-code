/*
 * What the Issue #6 acceptance test locates by on the generator screen.
 *
 * ui-design.md section 12 leaves the exact Japanese copy to the Issue that
 * builds the screen, so each expression below fixes only the word a visitor
 * needs to recognise the control by — not the sentence around it. Holding them
 * here rather than in the Page Object keeps a copy change to one edit
 * (ADR-0054); the MVP ships Japanese only (ui-design.md section 9), so there is
 * no locale to select between.
 */
export const generatorSelectors = {
  siteName: /Zipnami/,
  // The idle screen's explanation. Matched on the domain word, because the
  // generate action's own label contains it too; the paragraph role is what
  // separates the two, not the wording.
  explanation: /郵便番号/,
  generateAction: /生成/,
  copyAction: /コピー/,
  // Footer navigation. This is the unrelated control that must stay usable
  // while a generation is in flight.
  navigationLink: /プライバシー/,
} as const;

/*
 * Every standard way of marking a region whose changes are announced.
 *
 * ui-design.md section 8 requires results and errors to be announced but
 * deliberately leaves the urgency — assertive or polite — to the situation, so
 * pinning one role here would decide something the contract left open. These
 * are accessibility semantics rather than page structure, which is why the
 * acceptance test may depend on them at all (ADR-0012).
 */
export const liveRegionSelector =
  '[role="status"], [role="alert"], [aria-live], output';

/**
 * How the postal code reads on screen.
 *
 * ui-design.md section 5.3 shows it as `NNN-NNNN` while the canonical seven
 * digits stay the value the API and the clipboard carry.
 * @param postalCode - The canonical seven-digit postal code.
 */
export const displayedPostalCode = (postalCode: string) =>
  `${postalCode.slice(0, 3)}-${postalCode.slice(3)}`;

// Any displayed postal code, used to show the result region starts empty.
export const anyDisplayedPostalCode = /\d{3}-\d{4}/;

// GET /api/random on whatever origin VITE_API_BASE_URL baked into the build,
// with or without a query string.
export const randomEndpointPattern = /\/api\/random(?:\?.*)?$/;
