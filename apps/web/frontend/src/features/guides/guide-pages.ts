import { aboutPage } from "./about-page";
import { addressPage } from "./address-page";
import { barcodePage } from "./barcode-page";
import { businessCodePage } from "./business-code-page";
import { dataPage } from "./data-page";
import { historyPage } from "./history-page";
import { howToUsePage } from "./how-to-use-page";
import { municipalityCodePage } from "./municipality-code-page";
import { postalCodePage } from "./postal-code-page";
import { guideIndexPath, type GuidePage, type GuidePath } from "./types";
import { writingPage } from "./writing-page";

/*
 * The copy of the guide pages: five written for Issue #121 and expanded, and
 * five added, for Issue #170 (ui-design.md section 5.5). Every claim rests on
 * the official pages listed in sources.ts, and a claim none of them states is
 * not made ("Content rules").
 *
 * The dataset examples are entries of
 * packages/postal-data/data/ken-all.source.csv, worded as Zipnami shows them.
 * apps/web/backend/src/data/guide-copy-facts.medium.test.ts holds that the
 * bundled dataset says what the copy says, and
 * packages/postal-data/scripts/guide-source-facts.medium.test.ts holds the
 * KEN_ALL columns Zipnami does not keep.
 */

/** The five pages the footer's ガイド navigation lists, in its order. */
export const guidePages: readonly GuidePage[] = [
  aboutPage,
  postalCodePage,
  addressPage,
  dataPage,
  howToUsePage,
];

/** A group of guides, as the guide index lists it under its own heading. */
export type GuideCategory = {
  readonly name: string;
  /** One sentence on what the category's guides cover. */
  readonly description: string;
  readonly headingId: string;
  readonly pages: readonly GuidePage[];
};

/** The three categories, in the order the guide index shows them. */
export const guideCategories: readonly GuideCategory[] = [
  {
    name: "Zipnamiについて",
    description:
      "Zipnamiでできること、使い方、使っている郵便番号データの出典と加工のしかたをまとめています。",
    headingId: "guide-index-zipnami-heading",
    pages: [aboutPage, howToUsePage, dataPage],
  },
  {
    name: "郵便番号の基本",
    description:
      "郵便番号が何を単位に付けられているのか、住所とどう対応しているのか、どう書いてどう調べるのかを説明します。",
    headingId: "guide-index-basics-heading",
    pages: [postalCodePage, addressPage, historyPage, writingPage],
  },
  {
    name: "郵便番号をもっと詳しく",
    description:
      "事業所の個別番号、郵便物に印字されるバーコード、郵便番号データにある地方公共団体コードなど、一歩進んだしくみを扱います。",
    headingId: "guide-index-details-heading",
    pages: [businessCodePage, barcodePage, municipalityCodePage],
  },
];

/** Every guide once, in the guide index's order. */
export const allGuidePages: readonly GuidePage[] = guideCategories.flatMap(
  ({ pages }) => pages,
);

/**
 * The guide at a route. Every GuidePath has a page, so a related link can
 * never point at nothing.
 * @param {GuidePath} path - The guide's route.
 */
export const guidePageAt = (path: GuidePath): GuidePage => {
  const page = allGuidePages.find((candidate) => candidate.path === path);

  if (!page) {
    throw new Error(`No guide is listed at ${path}.`);
  }

  return page;
};

/** The guide index's own copy (ui-design.md section 5.5). */
export const guideIndexPage = {
  path: guideIndexPath,
  name: "ガイド一覧",
  description:
    "郵便番号のしくみ、書き方、データの出典など、Zipnamiのガイドをカテゴリごとに一覧にしています。",
  lead: "Zipnamiのガイドを、三つのカテゴリに分けて並べています。どのガイドも、日本郵便や総務省が公開している資料をもとに書いていて、ページの終わりに出典を載せています。",
} as const;

/** The name of the footer's navigation landmark on every screen. */
export const guideNavigationLabel = "ガイド";

/** The name of the footer's second landmark, which links to the index. */
export const guideIndexNavigationLabel = "すべてのガイド";

/** Every guide page's list of sources. */
export const sourcesHeading = "参考にした資料";

/** Every guide page's links to other guides. */
export const relatedGuidesHeading = "関連するガイド";
