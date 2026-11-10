/*
 * What the Issue #121 acceptance test locates the guide pages and the
 * generator's overview by.
 *
 * These screens have no Figma node yet (ui-design.md section 9.1), so the
 * names are not Figma copy. Each one is the exact string ui-design.md section
 * 5.5 fixes, which is the contract the Issue's acceptance criteria are written
 * against. Holding them in one place keeps a copy change to one edit
 * (ADR-0054).
 */

/** One guide page: the name its h1, footer link, and title carry, and its route. */
export type Guide = {
  readonly name: string;
  readonly path: string;
};

/*
 * The five guide pages, in the order the footer's ガイド navigation lists
 * them (ui-design.md section 5.5).
 */
export const guides: readonly Guide[] = [
  { name: "サイトについて", path: "/about" },
  { name: "郵便番号のしくみ", path: "/guide/postal-code" },
  { name: "郵便番号と住所", path: "/guide/address" },
  { name: "データについて", path: "/guide/data" },
  { name: "使い方", path: "/guide/how-to-use" },
];

export const guideSelectors = {
  // The footer's navigation landmark on every screen.
  footerNavigation: "ガイド",

  // The generator's two overview sections, shown while no result is shown.
  capabilitiesHeading: "Zipnamiでできること",
  learnMoreHeading: "郵便番号をもっと知る",

  // Every guide page's list of sources.
  sourcesHeading: "参考にした資料",

  // pageTitle (ui-design.md section 9.2) joins a page's name to the product.
  titleSuffix: " | Zipnami",

  // The word a means of contact is announced by. No page may carry one
  // (owner decision on Issue #121, 2026-11-10).
  contactWord: "お問い合わせ",
} as const;

/*
 * The origin every guide must cite at least once: Japan Post's own pages are
 * the sources ui-design.md section 5.5 requires for postal-code claims.
 */
export const japanPostOrigin = "https://www.post.japanpost.jp/";

/*
 * What the data page has to state, as packages/postal-data/README.md records
 * it: retrieved on 2026-11-03, yielding 120,721 postal codes. The date is
 * held in the Japanese form the rest of the copy is written in.
 */
export const dataPageFacts = {
  retrievalDate: "2026年11月3日",
  postalCodeCount: "120,721",
} as const;

/*
 * The three core capabilities the overview names (ui-design.md section 5.5):
 * drawing a code at random, every address with a map, and copying it and
 * finding it again in the history. Each is held as a word a visitor cannot
 * describe that capability without, not as a sentence, so the copy stays
 * free to change.
 */
export const capabilityWords = [/ランダム/, /地図/, /コピー/, /履歴/] as const;
