/**
 * Local copy of the frame's tap-target sizing (ui-design.md section 11: at
 * least 44px in each dimension). The boundaries lint rule keeps a feature
 * from importing app/styles.ts or another feature's styles.ts, so this
 * mirrors postal-generator/styles.ts rather than sharing it.
 */
const tapTargetClass = "inline-flex min-h-11 items-center";

/** Figma's "Outline Button": a brand-colored stroke and label on white. */
export const outlineButtonClass = `${tapTargetClass} rounded-full border border-brand bg-card px-6 text-caption font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`;
