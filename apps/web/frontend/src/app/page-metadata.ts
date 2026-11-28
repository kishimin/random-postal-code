import { allGuidePages, guideIndexPage } from "../features/guides/guide-pages";
import type { GuidePage } from "../features/guides/types";
import { notFoundHeading } from "./document-title";
import { pageTitle, siteText } from "./site-text";

/**
 * The description of the generator and of every path no route claims. It is
 * also what index.html ships (held by index-html.small.test.ts), so a page
 * that sets no description of its own still tells a crawler what the site is.
 */
export const siteDescription =
  "日本の郵便番号をランダムに1つ選び、その番号に対応するすべての住所と地図を表示します。";

const PRIVACY_DESCRIPTION =
  "Zipnamiが取得する情報、利用しているGoogleのサービス、履歴の保存先、お問い合わせの方法について説明します。";

/** What a page tells a crawler and a browser tab about itself. */
export type PageMetadata = {
  readonly title: string;
  readonly description: string;
  /** The page's own address, or null for a path no route claims. */
  readonly canonicalPath: string | null;
};

/**
 * A guide page's metadata, from the page's own copy.
 * @param {GuidePage} page - The guide page.
 */
export const guideMetadataOf = (page: GuidePage): PageMetadata => ({
  title: pageTitle(page.name),
  description: page.description,
  canonicalPath: page.path,
});

/** The guide index's metadata (Issue #170). */
export const guideIndexMetadata: PageMetadata = {
  title: pageTitle(guideIndexPage.name),
  description: guideIndexPage.description,
  canonicalPath: guideIndexPage.path,
};

const notFoundMetadata: PageMetadata = {
  title: pageTitle(notFoundHeading),
  description: siteDescription,
  canonicalPath: null,
};

const contentMetadata: ReadonlyMap<string, PageMetadata> = new Map([
  [
    "/",
    { title: pageTitle(), description: siteDescription, canonicalPath: "/" },
  ],
  ...allGuidePages.map((page): [string, PageMetadata] => [
    page.path,
    guideMetadataOf(page),
  ]),
  [guideIndexPage.path, guideIndexMetadata],
  [
    "/privacy",
    {
      title: pageTitle(siteText.privacyLabel),
      description: PRIVACY_DESCRIPTION,
      canonicalPath: "/privacy",
    },
  ],
]);

/**
 * The content routes: the pages prerendered at build time, listed in the
 * sitemap, and given a canonical URL (docs/design.md section 6.2).
 */
export const contentRoutePaths: readonly string[] = [...contentMetadata.keys()];

/**
 * The title, description and canonical path of the screen at a path.
 *
 * One table for the screens that set them while mounted and for the build that
 * writes them into each prerendered file, so the HTML a crawler reads and the
 * head the client keeps cannot describe a page differently.
 * @param {string} pathname - The route's path, without a trailing slash.
 */
export const pageMetadataFor = (pathname: string): PageMetadata =>
  contentMetadata.get(pathname) ?? notFoundMetadata;
