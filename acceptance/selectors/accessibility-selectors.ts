/*
 * What the Issue #16 acceptance test locates and measures by.
 *
 * The names and texts the test finds controls and statuses by are the exact
 * strings in figma-copy.ts (approved on Issue #97). What remains here is how
 * the screens are measured. Holding it here rather than in the Page Object
 * keeps a change to one edit (ADR-0054).
 */

/** One viewport the responsive criterion is verified at. */
export type RepresentativeViewport = {
  readonly name: string;
  readonly width: number;
  readonly height: number;
};

/*
 * ui-design.md section 10's minimum verification set: narrow phones at 320px
 * and 390px, a tablet at 768px, desktops at 1024px and 1440px, and portrait
 * and landscape orientations. The landscape entry is a 390px-wide phone turned
 * on its side. 1024px is also where section 5.1 changes the layout from one
 * column to two, so both sides of that boundary are in the set (768px below,
 * 1024px at it).
 *
 * The heights are ordinary device heights. No assertion reads them; they
 * exist because a viewport needs one.
 */
export const representativeViewports: readonly RepresentativeViewport[] = [
  { name: "narrow phone 320px", width: 320, height: 640 },
  { name: "phone 390px", width: 390, height: 844 },
  { name: "phone landscape 844px", width: 844, height: 390 },
  { name: "tablet 768px", width: 768, height: 1024 },
  { name: "desktop 1024px", width: 1024, height: 768 },
  { name: "wide desktop 1440px", width: 1440, height: 900 },
];

/*
 * What each screen's document title has to name.
 *
 * WCAG 2.4.2 (Page Titled, Level A) asks for a title that describes the
 * page's topic, which is what lets a visitor tell two open tabs, two history
 * entries, or two windows in a screen reader's list apart. Each expression is
 * the word that screen's own top-level heading carries, so a title that
 * names the page satisfies it without the test fixing the whole string. A title
 * may carry the product name as well ("プライバシーポリシー | Zipnami"), so
 * the test also requires the three titles to differ: one shared title cannot
 * satisfy all three screens.
 */
export const documentTitleSelectors = {
  generator: /Zipnami/,
  privacy: /プライバシー/,
  notFound: /見つかりません/,
} as const;

/*
 * The WCAG levels the automated scan checks.
 *
 * Level A and AA of WCAG 2.0, 2.1 and 2.2 are what "accessibility
 * requirements" means for a public Web product in the absence of anything
 * narrower (design.md section 8 names no other standard). axe-core tags its
 * rules by the success criterion they test, so these select exactly those
 * levels and leave axe's "best-practice" rules — advice rather than a
 * conformance requirement — out.
 */
export const wcagTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;

/*
 * How far past an element's own box a focus indicator may be drawn.
 *
 * Browsers draw the default focus ring outside the element, and a designed one
 * is commonly an outline with an offset, so the area compared before and after
 * focusing has to include a margin around the control. Eight CSS pixels holds
 * the default rings of every engine in this suite and any outline a design
 * system would plausibly offset.
 */
export const focusIndicatorMargin = 8;
