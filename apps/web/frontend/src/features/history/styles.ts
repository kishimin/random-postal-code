/**
 * Local copy of the frame's tap-target sizing (ui-design.md section 11: at
 * least 44px in each dimension). The boundaries lint rule keeps a feature
 * from importing app/styles.ts or another feature's styles.ts, so this
 * mirrors postal-generator/styles.ts rather than sharing it.
 */
export const tapTargetClass = "inline-flex min-h-11 items-center";
