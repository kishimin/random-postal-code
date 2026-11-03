/**
 * Classes shared by the application frame.
 *
 * ui-design.md section 11 asks for interactive targets of at least 44px in
 * each dimension. A text link inherits only its line height, so the padding
 * that makes the row look right sits on the surrounding element and leaves the
 * target itself at 20px — under the WCAG 2.5.8 minimum as well. These put the
 * height on the target.
 *
 * Colors and sizes are theme tokens (ui-design.md section 9.3), never raw
 * values.
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

/**
 * The brand-accent pill Figma draws as "Primary Button", for a link that acts
 * as the screen's one primary action (the not-found screen's way back).
 *
 * White on the brand color is 3.75:1, which WCAG 1.4.3 accepts only for large
 * text, so the label uses the 19px action size at weight 700 (14pt bold)
 * instead of Figma's 16px. A shape, not an underline, carries the affordance.
 */
export const primaryActionClass =
  "inline-flex min-h-13 w-full max-w-[280px] items-center justify-center rounded-full bg-brand px-8 text-action font-bold text-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The white header band; its content sits in `frameInnerClass`. */
export const headerClass = "bg-card";

/**
 * The 1200px container of ui-design.md section 5.1. Its horizontal padding is
 * what keeps content off the edges at a 320px viewport.
 */
export const frameInnerClass = "mx-auto w-full max-w-[1200px] px-5 lg:px-12";

/** The wordmark: markup text `Zipnami`, painted upper-case as Figma draws it. */
export const wordmarkClass = `${tapTargetClass} text-action font-bold tracking-wider text-ink uppercase lg:text-heading`;

/** Footer text: 11px on small screens and 12px on large, as Figma sets it. */
export const footerTextClass = "text-caption-sm text-ink-muted lg:text-caption";

/** The footer's privacy link, which both frames build themselves. */
export const privacyLinkClass = `${linkClass} ${footerTextClass}`;
