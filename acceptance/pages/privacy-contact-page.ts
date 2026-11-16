import type { Page } from "@playwright/test";
import { privacyContactSelectors } from "../selectors/privacy-contact-selectors.ts";

/**
 * Page Object for the contact section of the privacy page (Issue #105).
 *
 * Separate from `privacy-disclosure-page.ts`, which is locked by the ATDD
 * guard and whose section list holds Figma's first four headings only.
 * @param page - The Playwright page driving the browser.
 */
export const createPrivacyContactPage = (page: Page) => {
  const { sectionHeading, linkName, formUrl } = privacyContactSelectors;

  // A region named by its own heading, like the page's other four sections.
  const section = () =>
    page.getByRole("region", { name: sectionHeading, exact: true });

  // Located inside the region, so resolving at all shows the heading is the
  // region's own rather than an aria-label repeating its words.
  const headingOfSection = () =>
    section().getByRole("heading", {
      name: sectionHeading,
      exact: true,
      level: 2,
    });

  // The section headings of the page, in document order, so the test can
  // show the contact section comes after the other four as Figma orders them.
  const sectionHeadingsInOrder = () =>
    page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents();

  // Every link in the section, whatever it is named, so a second link fails.
  const linksInSection = () => section().getByRole("link");

  const contactLink = () =>
    section().getByRole("link", { name: linkName, exact: true });

  /**
   * The section, when it states the given thing. Filtering the region rather
   * than locating the sentence keeps the count off the markup.
   * @param statement - What the section has to state.
   */
  const sectionStating = (statement: RegExp) =>
    section().filter({ hasText: statement });

  /*
   * Answers the form's address with a stand-in page, so following the link
   * contacts no Google service and the test can still show where it led.
   */
  const answerFormWithStandIn = () =>
    page.route(`${formUrl}**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Contact form stand-in</title>",
      }),
    );

  const currentUrl = () => page.url();

  return {
    section,
    headingOfSection,
    sectionHeadingsInOrder,
    linksInSection,
    contactLink,
    sectionStating,
    answerFormWithStandIn,
    currentUrl,
  };
};

export type PrivacyContactPage = ReturnType<typeof createPrivacyContactPage>;
