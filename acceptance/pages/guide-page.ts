import type { Locator, Page } from "@playwright/test";
import { chromeSelectors } from "../selectors/chrome-selectors.ts";
import { guideSelectors } from "../selectors/guide-selectors.ts";

/**
 * Page Object for Issue #121's guide pages, the footer's ガイド navigation,
 * and the generator's overview sections.
 *
 * Everything is located by role and accessible name (ADR-0012). The few
 * questions that are not about a role — the meta description, a `mailto:`
 * or `tel:` link, a form — are answered here so the test states only what it
 * expects, and each is a public contract of the document rather than of
 * Zipnami's markup: what a crawler reads, and what a visitor could use to
 * make contact.
 * @param page - The Playwright page driving the browser.
 */
export const createGuidePage = (page: Page) => {
  /**
   * Loads a path directly, as a deep link or a crawler would.
   * @param path - The path to request.
   */
  const navigate = (path: string) => page.goto(path);

  // A refresh of whatever page is open: on Cloudflare Pages and under vite
  // preview, it is the SPA fallback that has to answer it.
  const reload = () => page.reload();

  const currentPath = () => new URL(page.url()).pathname;

  const documentTitle = () => page.title();

  // The description a crawler reads, as it stands now. Empty when the page
  // has none, so "has one" and "has an empty one" read the same.
  const metaDescription = () =>
    page.evaluate(
      () =>
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content")
          ?.trim() ?? "",
    );

  const main = () => page.getByRole("main");

  /**
   * The page's h1, when it carries exactly this name.
   * @param name - The page's name.
   */
  const heading = (name: string) =>
    page.getByRole("heading", { level: 1, name, exact: true });

  const topLevelHeadings = () => page.getByRole("heading", { level: 1 });

  const notFoundHeading = () =>
    page.getByRole("heading", {
      level: 1,
      name: chromeSelectors.notFoundHeading,
      exact: true,
    });

  // Every second-level heading inside main, as a visitor reads them.
  const sectionHeadingNames = async () =>
    (await main().getByRole("heading", { level: 2 }).allInnerTexts()).map(
      (name) => name.trim(),
    );

  /**
   * A labelled region inside main.
   * @param name - The whole accessible name, which is its visible heading.
   */
  const region = (name: string) =>
    main().getByRole("region", { name, exact: true });

  /**
   * The region, when its own heading is inside it under the same name.
   *
   * Resolving at all shows the region is named by its visible h2, not by an
   * aria-label that only repeats the words.
   * @param name - The region's heading, exactly.
   */
  const headingOfRegion = (name: string) =>
    region(name).getByRole("heading", { level: 2, name, exact: true });

  /**
   * How much text a region carries beyond its own heading.
   * @param name - The region's heading, exactly.
   */
  const bodyTextLength = async (name: string) =>
    (await region(name).innerText()).replace(name, "").trim().length;

  const sourcesRegion = () => region(guideSelectors.sourcesHeading);

  // Where each link in the sources section leads, resolved to an absolute URL.
  const sourceLinkTargets = () =>
    sourcesRegion()
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).href),
      );

  /**
   * Main, when it states the given text somewhere a visitor can read it.
   * @param text - What main has to state.
   */
  const mainStating = (text: string | RegExp) =>
    main().filter({ hasText: text });

  /**
   * The whole page, when it carries the given text anywhere.
   * @param text - The text to look for.
   */
  const pageStating = (text: string | RegExp) =>
    page.locator("body").filter({ hasText: text });

  // A link that would start an e-mail or a phone call.
  const contactLinks = () =>
    page.locator('a[href^="mailto:" i], a[href^="tel:" i]');

  const forms = () => page.locator("form");

  const footerGuideNavigation = () =>
    page.getByRole("contentinfo").getByRole("navigation", {
      name: guideSelectors.footerNavigation,
      exact: true,
    });

  const footerGuideLinks = () => footerGuideNavigation().getByRole("link");

  /**
   * One link of the footer's ガイド navigation.
   * @param name - The guide's name, exactly.
   */
  const footerGuideLink = (name: string) =>
    footerGuideNavigation().getByRole("link", { name, exact: true });

  const capabilitiesRegion = () => region(guideSelectors.capabilitiesHeading);

  const learnMoreRegion = () => region(guideSelectors.learnMoreHeading);

  const learnMoreLinks = () => learnMoreRegion().getByRole("link");

  /**
   * The accessible name of the nth link in 郵便番号をもっと知る.
   * @param index - Which link, from zero.
   */
  const learnMoreLinkName = async (index: number) =>
    (await learnMoreLinks().nth(index).innerText()).trim();

  /**
   * Follows a link with the pointer.
   * @param link - The link to follow.
   */
  const follow = (link: Locator) => link.click();

  return {
    navigate,
    reload,
    currentPath,
    documentTitle,
    metaDescription,
    main,
    heading,
    topLevelHeadings,
    notFoundHeading,
    sectionHeadingNames,
    region,
    headingOfRegion,
    bodyTextLength,
    sourcesRegion,
    sourceLinkTargets,
    mainStating,
    pageStating,
    contactLinks,
    forms,
    footerGuideNavigation,
    footerGuideLinks,
    footerGuideLink,
    capabilitiesRegion,
    learnMoreRegion,
    learnMoreLinks,
    learnMoreLinkName,
    follow,
  };
};

export type GuidePage = ReturnType<typeof createGuidePage>;
