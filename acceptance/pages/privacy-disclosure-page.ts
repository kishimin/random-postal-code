import type { Page } from "@playwright/test";
import {
  privacySelectors,
  type PrivacySectionHeading,
} from "../selectors/privacy-selectors.ts";
import {
  narrowPhoneViewport,
  shellSelectors,
} from "../selectors/shell-selectors.ts";

/**
 * Page Object for the privacy and attribution disclosure of Issue #10.
 *
 * Separate from `privacy-page.ts`, which Issue #5 committed to hold one thing:
 * that a deep link to the route resolves at all. That file is locked by the
 * ATDD guard, and what this Issue adds — the sections and the denials — is a
 * different subject rather than a correction of it.
 *
 * The Japan Post credit is reachable from here as well, even though it is not
 * on the privacy route alone. The Issue asks for it "in the application or
 * information page", so the credit is located page-wide rather than pinned to
 * the frame that currently carries it.
 * @param page - The Playwright page driving the browser.
 */
export const createPrivacyDisclosurePage = (page: Page) => {
  const navigate = () => page.goto("/privacy");

  const main = () => page.getByRole("main");

  const heading = () =>
    page.getByRole("heading", {
      name: shellSelectors.privacyHeading,
      exact: true,
      level: 1,
    });

  // ui-design.md section 8: one h1 per page. Counted rather than located, so
  // the test can show the disclosure did not arrive as a second page title.
  const topLevelHeadings = () => page.getByRole("heading", { level: 1 });

  // Figma's four section headings, in the page's order.
  const sectionHeadings: readonly PrivacySectionHeading[] = Object.values(
    privacySelectors.sectionHeadings,
  );

  /**
   * The section a heading names, as a region.
   * @param name - The section's heading, exactly.
   */
  const section = (name: PrivacySectionHeading) =>
    page.getByRole("region", { name, exact: true });

  /**
   * The heading inside the section it names.
   *
   * Located inside the region rather than page-wide, so that it resolving at
   * all shows the heading is that region's own — a region named by an
   * `aria-label` that only repeats the words would not carry it.
   * @param name - The section's heading, exactly.
   */
  const headingOfSection = (name: PrivacySectionHeading) =>
    section(name).getByRole("heading", { name, exact: true });

  /**
   * The section, when it states the given thing.
   *
   * Filtering the section rather than locating the sentence keeps the
   * assertion off the markup: a text locator also matches every ancestor that
   * contains the text, so a count would measure wrappers. A section resolves
   * to exactly one element, so this resolves to one when the statement is
   * inside it and to nothing when it is not.
   * @param name - The section's heading, exactly.
   * @param statement - What the section has to state.
   */
  const sectionStating = (name: PrivacySectionHeading, statement: RegExp) =>
    section(name).filter({ hasText: statement });

  const disclosureLink = () =>
    page.getByRole("link", {
      name: privacySelectors.disclosureLink,
      exact: true,
    });

  // press() focuses the control and sends real key events, which a control
  // that only answers a mouse click does not act on.
  const openDisclosureWithKeyboard = () => disclosureLink().press("Enter");

  /*
   * The Japan Post credit.
   *
   * Located page-wide, because the Issue accepts the credit "in the
   * application or information page" and which surface carries it is the
   * implementation's choice. A text locator also matches every ancestor
   * holding the text, so the first match is taken: the question is whether a
   * visitor can read the credit, not how many elements contain it.
   */
  const japanPostCredit = () =>
    page.getByText(privacySelectors.japanPostCredit, { exact: true }).first();

  const resizeToNarrowPhone = () => page.setViewportSize(narrowPhoneViewport);

  // Compares the document's scrollable width against its visible width. A
  // larger scrollWidth means content overflows horizontally, which ui-design.md
  // section 5.1 forbids at this viewport.
  const hasHorizontalOverflow = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

  // The route the browser is on, so a link activated by keyboard can be shown
  // to have arrived rather than only to have rendered something.
  const currentPath = () => new URL(page.url()).pathname;

  return {
    navigate,
    main,
    heading,
    topLevelHeadings,
    sectionHeadings,
    section,
    headingOfSection,
    sectionStating,
    disclosureLink,
    openDisclosureWithKeyboard,
    japanPostCredit,
    resizeToNarrowPhone,
    hasHorizontalOverflow,
    currentPath,
  };
};

export type PrivacyDisclosurePage = ReturnType<
  typeof createPrivacyDisclosurePage
>;
