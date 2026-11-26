import type { Guide } from "./guide-selectors.ts";

/*
 * What the Issue #170 acceptance test locates the guide index, the ten
 * guides and their categories by.
 *
 * Every string is ui-design.md section 5.5's contract ("Guide index and
 * categories", "Related guides"), which the Issue's first acceptance
 * criterion required before the implementation. The five guides of Issue
 * #121 keep their names and routes from guide-selectors.ts.
 */

/** A guide and the category the guide index lists it under. */
export type CategorizedGuide = Guide & {
  readonly category: string;
};

/** The guide index every guide is listed on. */
export const guideIndex: Guide = { name: "ガイド一覧", path: "/guide" };

/** The three categories, in the order the guide index shows them. */
export const guideCategories = [
  "Zipnamiについて",
  "郵便番号の基本",
  "郵便番号をもっと詳しく",
] as const;

/*
 * The ten guides in the contract's table order: grouped by category, and in
 * that order within each category on the guide index.
 */
export const categorizedGuides: readonly CategorizedGuide[] = [
  { name: "サイトについて", path: "/about", category: "Zipnamiについて" },
  { name: "使い方", path: "/guide/how-to-use", category: "Zipnamiについて" },
  { name: "データについて", path: "/guide/data", category: "Zipnamiについて" },
  {
    name: "郵便番号のしくみ",
    path: "/guide/postal-code",
    category: "郵便番号の基本",
  },
  {
    name: "郵便番号と住所",
    path: "/guide/address",
    category: "郵便番号の基本",
  },
  {
    name: "7桁の郵便番号になるまで",
    path: "/guide/history",
    category: "郵便番号の基本",
  },
  {
    name: "郵便番号の書き方と調べ方",
    path: "/guide/writing",
    category: "郵便番号の基本",
  },
  {
    name: "事業所の個別郵便番号",
    path: "/guide/business-code",
    category: "郵便番号をもっと詳しく",
  },
  {
    name: "郵便番号とバーコード",
    path: "/guide/barcode",
    category: "郵便番号をもっと詳しく",
  },
  {
    name: "郵便番号と地方公共団体コード",
    path: "/guide/municipality-code",
    category: "郵便番号をもっと詳しく",
  },
];

/*
 * The five guides Issue #170 adds, in the order the contract's route table
 * lists them. The other five are guide-selectors.ts's guides.
 */
export const newGuides: readonly Guide[] = [
  { name: "7桁の郵便番号になるまで", path: "/guide/history" },
  { name: "事業所の個別郵便番号", path: "/guide/business-code" },
  { name: "郵便番号の書き方と調べ方", path: "/guide/writing" },
  { name: "郵便番号とバーコード", path: "/guide/barcode" },
  { name: "郵便番号と地方公共団体コード", path: "/guide/municipality-code" },
];

export const guideArticleSelectors = {
  // The footer's second navigation landmark and its one link.
  indexNavigation: "すべてのガイド",
  indexLink: "ガイド一覧",

  // The region of each guide that links to other guides.
  relatedGuidesHeading: "関連するガイド",
} as const;

/*
 * The official origins a guide may cite (ui-design.md section 5.5, "Content
 * rules"): Japan Post's site and 総務省's.
 */
export const officialSourceOrigins = [
  "https://www.post.japanpost.jp/",
  "https://www.soumu.go.jp/",
] as const;

/*
 * The Issue's floor for each guide's body text, counted as the contract
 * counts it: characters other than whitespace, outside the headings, the
 * related-guides links and the sources.
 */
export const minimumBodyCharacters = 2000;
