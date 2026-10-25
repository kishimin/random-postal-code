/**
 * Japanese strings the advertising region shows. ui-design.md section 12
 * leaves the exact copy to this Issue; the MVP ships Japanese only (section
 * 9), so there is no locale to select between.
 *
 * ui-design.md sections 7 and 8: a dedicated, labeled region, identified by
 * more than colour alone -- this text is both the visible label a sighted
 * visitor sees and, through aria-labelledby, the region's accessible name.
 */
export const advertisingText = {
  regionLabel: "広告",
} as const;
