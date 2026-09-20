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
