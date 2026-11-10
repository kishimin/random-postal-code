import { aboutPage } from "./about-page";
import { addressPage } from "./address-page";
import { dataPage } from "./data-page";
import { howToUsePage } from "./how-to-use-page";
import { postalCodePage } from "./postal-code-page";
import type { GuidePage } from "./types";

/*
 * The copy of the five guide pages, written for Issue #121 from Japan Post's
 * KEN_ALL readme and download page and from packages/postal-data/README.md
 * only (ui-design.md section 5.5, "Content rules"). The pages deliberately do
 * not say when the seven-digit code was introduced, what each digit means, or
 * how often Japan Post publishes: none of the sources above states them.
 *
 * The dataset examples are entries of
 * packages/postal-data/data/ken-all.source.csv, worded as Zipnami shows them.
 * apps/web/backend/src/data/guide-copy-facts.medium.test.ts holds that the
 * bundled dataset says what the copy says.
 */

/** The five pages, in the order the footer's ガイド navigation lists them. */
export const guidePages: readonly GuidePage[] = [
  aboutPage,
  postalCodePage,
  addressPage,
  dataPage,
  howToUsePage,
];

/** Every guide page's list of sources. */
export const sourcesHeading = "参考にした資料";
