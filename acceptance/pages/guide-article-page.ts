import type { Page } from "@playwright/test";
import { guideArticleSelectors } from "../selectors/guide-article-selectors.ts";
import { guideSelectors } from "../selectors/guide-selectors.ts";

/**
 * Page Object for Issue #170: how much a guide says, what it links to, and
 * how the guide index and the footer's すべてのガイド navigation lead to it.
 *
 * Added as a new file next to guide-page.ts, which is locked. Regions,
 * headings, paragraphs and links are found by role and accessible name
 * (ADR-0012). The only reads that are not about a role are a link's resolved
 * address and the text a region shows, which are what a crawler and a reader
 * meet.
 * @param page - The Playwright page driving the browser.
 */
export const createGuideArticlePage = (page: Page) => {
  const main = () => page.getByRole("main");

  /**
   * A labelled region inside main.
   * @param name - Its whole accessible name, which is its visible heading.
   */
  const region = (name: string) =>
    main().getByRole("region", { name, exact: true });

  // The regions that are not body text: the sources and the related guides.
  const notBody: readonly string[] = [
    guideSelectors.sourcesHeading,
    guideArticleSelectors.relatedGuidesHeading,
  ];

  /**
   * How many characters of body text the page carries, counted as the
   * contract counts them: the text of each body region without its own
   * heading, with whitespace removed, in code points.
   *
   * The lead above the first region is left out, so the count can only
   * understate the body: a page that passes has at least this much.
   */
  const bodyCharacterCount = async () => {
    let count = 0;

    for (const body of await main().getByRole("region").all()) {
      const heading = (
        await body.getByRole("heading", { level: 2 }).first().innerText()
      ).trim();
      if (notBody.includes(heading)) continue;

      const text = (await body.innerText()).replace(heading, "");
      count += [...text.replace(/\s/g, "")].length;
    }

    return count;
  };

  // Every paragraph a visitor reads in main, trimmed.
  const paragraphTexts = async () =>
    (await main().getByRole("paragraph").allInnerTexts()).map((text) =>
      text.trim(),
    );

  // Everything main says, as one string.
  const mainText = () => main().innerText();

  const relatedGuidesRegion = () =>
    region(guideArticleSelectors.relatedGuidesHeading);

  const relatedGuideLinks = () => relatedGuidesRegion().getByRole("link");

  /**
   * Where the links inside main lead, as paths on this site. Links to other
   * sites (the sources) are left out: they are not this site's to answer.
   */
  const ownLinkPaths = () =>
    main()
      .getByRole("link")
      .evaluateAll((links) =>
        links
          .map((link) => new URL((link as HTMLAnchorElement).href))
          .filter((url) => url.origin === window.location.origin)
          .map((url) => url.pathname),
      );

  /**
   * One category region of the guide index.
   * @param category - The category's name, which is the region's heading.
   */
  const categoryRegion = (category: string) => region(category);

  /**
   * The names of the links in one category region, in order.
   * @param category - The category's name.
   */
  const categoryLinkNames = async (category: string) =>
    (await categoryRegion(category).getByRole("link").allInnerTexts()).map(
      (name) => name.trim(),
    );

  /**
   * A link inside main, by its exact name.
   * @param name - The link's accessible name.
   */
  const mainLink = (name: string) =>
    main().getByRole("link", { name, exact: true });

  const footerIndexNavigation = () =>
    page.getByRole("contentinfo").getByRole("navigation", {
      name: guideArticleSelectors.indexNavigation,
      exact: true,
    });

  const footerIndexLink = () =>
    footerIndexNavigation().getByRole("link", {
      name: guideArticleSelectors.indexLink,
      exact: true,
    });

  return {
    main,
    region,
    bodyCharacterCount,
    paragraphTexts,
    mainText,
    relatedGuidesRegion,
    relatedGuideLinks,
    ownLinkPaths,
    categoryRegion,
    categoryLinkNames,
    mainLink,
    footerIndexNavigation,
    footerIndexLink,
  };
};

export type GuideArticlePage = ReturnType<typeof createGuideArticlePage>;
