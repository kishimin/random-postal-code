/**
 * Classes shared by the application frame.
 *
 * ui-design.md section 11 asks for interactive targets of at least 44px in
 * each dimension. A text link inherits only its line height, so the padding
 * that makes the row look right sits on the surrounding element and leaves the
 * target itself at 20px — under the WCAG 2.5.8 minimum as well. These put the
 * height on the target.
 */
export const tapTargetClass = "inline-flex min-h-11 items-center";

/**
 * Classes for an in-content link.
 *
 * Tailwind's preflight resets `a { color: inherit; text-decoration: inherit; }`
 * (CR-005 of Issue #10's review), which leaves a link with no affordance but
 * its surrounding color. `underline` restores one that survives regardless of
 * whichever color tokens the UI foundation work fixes later, and keeps
 * tapTargetClass's sizing intact. Presentation only, so no test asserts it
 * (ADR-0012); the manual checklist in ui-design.md section 10 covers it.
 */
export const linkClass = `${tapTargetClass} underline`;
