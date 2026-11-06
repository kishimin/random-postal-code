/**
 * Local copy of the frame's tap-target sizing (ui-design.md section 11: at
 * least 44px in each dimension). Feature code cannot import app/styles.ts --
 * the boundaries lint rule keeps features/ from depending on app/ -- so this
 * mirrors that class rather than sharing the module.
 */
const tapTargetClass = "inline-flex min-h-11 items-center";

/**
 * The brand-accent pill Figma draws as "Primary Button". White on the brand
 * color is 5.61:1, so the label takes Figma's own 16px size and weight. A
 * disabled button, which is the loading state, turns to the secondary text
 * color so the state is not carried by the brand color's absence alone: the
 * loading text says it too.
 */
export const primaryButtonClass =
  "inline-flex min-h-13 w-full items-center justify-center rounded-full bg-brand px-8 text-button font-bold text-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:bg-ink-muted";

/** Figma's "Outline Button": a brand-colored stroke and label on white. */
export const secondaryButtonClass = `${tapTargetClass} rounded-full border border-brand bg-card px-6 text-caption font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`;

/** The small bold label above a headline. */
export const eyebrowClass =
  "text-caption-sm font-bold tracking-widest text-ink-muted uppercase lg:text-eyebrow";
