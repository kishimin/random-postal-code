/**
 * Local copy of the frame's tap-target sizing (ui-design.md section 11: at
 * least 44px in each dimension). Feature code cannot import app/styles.ts --
 * the boundaries lint rule keeps features/ from depending on app/ -- so this
 * mirrors that class rather than sharing the module.
 */
export const tapTargetClass = "inline-flex min-h-11 items-center";

/**
 * The brand-accent pill Figma draws as "Primary Button". White on the brand
 * color is 3.75:1, which WCAG 1.4.3 accepts only for large text, so the label
 * is the 19px action size at weight 700 (14pt bold) rather than Figma's 16px.
 * A disabled button, which is the loading state, turns to the secondary text
 * color so the state is not carried by the brand color's absence alone: the
 * loading text says it too.
 */
export const primaryButtonClass =
  "inline-flex min-h-13 w-full items-center justify-center rounded-full bg-brand px-8 text-action font-bold text-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:bg-ink-muted";

/** Small outlined pill for a secondary action, such as copying the code. */
export const secondaryButtonClass = `${tapTargetClass} rounded-full border border-card-border bg-card px-4 text-body-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`;

/** The small bold label above a headline. */
export const eyebrowClass =
  "text-caption-sm font-bold tracking-widest text-ink-muted uppercase lg:text-eyebrow";
