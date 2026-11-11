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
const tapTargetClass = "inline-flex min-h-11 items-center";

/**
 * The brand-accent pill Figma draws as "Primary Button", for a link that acts
 * as the screen's one primary action: the way back to `/` from the not-found
 * screen, the global error screen, and the end of a guide page.
 *
 * White on the brand color is 5.61:1, so the label takes Figma's own 16px size
 * and weight. A shape, not an underline, carries the affordance.
 */
export const primaryActionClass =
  "inline-flex min-h-13 w-full max-w-[280px] items-center justify-center rounded-full bg-brand px-8 text-button font-bold text-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The white header band; its content sits in `frameInnerClass`. */
export const headerClass = "bg-card";

/**
 * The header's and the footer's container. Its horizontal padding is what
 * keeps content off the edges at a 320px viewport.
 */
export const frameInnerClass = "mx-auto w-full max-w-[1200px] px-5 lg:px-12";

/**
 * Main's container: ui-design.md section 5.1's 1312px content width, with
 * 64px side margins at a 1440px viewport (Figma node 1:4, Issue #111). The
 * maximum includes the padding, so wider screens keep the same 1312px.
 *
 * Not shared with the header: its logo and wordmark sit nearer the edge in
 * Figma, and the header logo is a separate Issue (#113).
 */
export const mainInnerClass = "mx-auto w-full max-w-[1440px] px-5 lg:px-16";

/** The wordmark: markup text `ZIPNAMI`, Figma's literal (section 9.3). */
export const wordmarkClass = `${tapTargetClass} text-action font-bold tracking-wider text-ink lg:text-heading`;

/** Footer text: 11px on small screens and 12px on large, as Figma sets it. */
export const footerTextClass = "text-caption-sm text-ink-muted lg:text-caption";

/**
 * The footer's privacy link, which both frames build themselves: Figma's
 * "Outline Button" (#46:69), a brand-colored stroke and label on white.
 */
export const privacyLinkClass = `${tapTargetClass} rounded-full border border-brand bg-card px-6 text-caption font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`;

/**
 * A link set in the body of a content screen (Issue #121): a guide's sources,
 * and the overview's links to the guides. These screens have no Figma node, so
 * the link takes the brand color the privacy link already uses, on a white
 * card, where it is 5.61:1. The underline, not the color alone, marks it as a
 * link (WCAG 1.4.1).
 */
export const contentLinkClass = `${tapTargetClass} text-body-sm text-brand underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`;

/**
 * A link of the footer's ガイド navigation, which both frames build themselves.
 * It sits in the footer's own text color, which is already legible on the page
 * background, and the underline marks it as a link. The horizontal padding
 * widens the 44px-high target on a phone, where five labels wrap onto rows.
 */
export const guideLinkClass = `${tapTargetClass} px-3 text-caption text-ink-muted underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`;
