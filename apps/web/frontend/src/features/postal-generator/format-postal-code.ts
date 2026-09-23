/**
 * Formats the canonical seven-digit postal code for display (ui-design.md
 * section 5.3: `NNN-NNNN`). The canonical value itself is left unchanged for
 * the API and the clipboard.
 */
export const formatPostalCode = (postalCode: string): string =>
  `${postalCode.slice(0, 3)}-${postalCode.slice(3)}`;
