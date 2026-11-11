import type { Locator, Page } from "@playwright/test";
import { figmaCopy } from "../selectors/figma-copy.ts";

/**
 * Page Object for the トップへ戻る link that ends each guide page (Issue #121,
 * owner decision of 2026-11-11).
 *
 * A new file rather than an addition to guide-page.ts, which is a committed
 * file under acceptance/ and locked. Everything is located by role and
 * accessible name (ADR-0012).
 * @param page - The Playwright page driving the browser.
 */
export const createGuideBackToTopPage = (page: Page) => {
  const main = () => page.getByRole("main");

  const linkNamed = (scope: Locator) =>
    scope.getByRole("link", { name: figmaCopy.backToTop, exact: true });

  // Every トップへ戻る link in the page's own content.
  const backToTopLinks = () => linkNamed(main());

  // Every トップへ戻る link in the header or the footer, where it must not be.
  const headerBackToTopLinks = () => linkNamed(page.getByRole("banner"));
  const footerBackToTopLinks = () => linkNamed(page.getByRole("contentinfo"));

  // The name of the last link in main, as a visitor reads down the page.
  const lastLinkInMainName = async () =>
    (await main().getByRole("link").last().innerText()).trim();

  const currentPath = () => new URL(page.url()).pathname;

  // Follows the page's トップへ戻る link with the pointer.
  const followBackToTop = () => backToTopLinks().click();

  return {
    backToTopLinks,
    headerBackToTopLinks,
    footerBackToTopLinks,
    lastLinkInMainName,
    currentPath,
    followBackToTop,
  };
};

export type GuideBackToTopPage = ReturnType<typeof createGuideBackToTopPage>;
