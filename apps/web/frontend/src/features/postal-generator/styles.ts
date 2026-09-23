/**
 * Local copy of the frame's tap-target sizing (ui-design.md section 11: at
 * least 44px in each dimension). Feature code cannot import app/styles.ts --
 * the boundaries lint rule keeps features/ from depending on app/ -- so this
 * mirrors that class rather than sharing the module.
 */
export const tapTargetClass = "inline-flex min-h-11 items-center";
