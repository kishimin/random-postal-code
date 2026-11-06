import { figmaCopy } from "./figma-copy.ts";

/*
 * What the Issue #6 acceptance test locates by on the generator screen.
 *
 * Each name is the exact string a visitor reads, taken from figma-copy.ts
 * (approved on Issue #97). The generate action is not here: its label
 * depends on the screen's state, so the Page Object chooses among
 * figmaCopy.startAction, regenerateAction, and retryAction.
 */
export const generatorSelectors = {
  copyAction: figmaCopy.copyAction,
  // Footer navigation. This is the unrelated control that must stay usable
  // while a generation is in flight.
  navigationLink: figmaCopy.privacyLink,
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
