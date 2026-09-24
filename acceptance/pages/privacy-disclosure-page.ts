import type { Page } from "@playwright/test";
import { privacySelectors } from "../selectors/privacy-selectors.ts";
import {
  narrowPhoneViewport,
  shellSelectors,
} from "../selectors/shell-selectors.ts";

/**
 * Page Object for the privacy and attribution disclosure of Issue #10.
 *
 * Separate from `privacy-page.ts`, which Issue #5 committed to hold one thing:
 * that a deep link to the route resolves at all. That file is locked by the
 * ATDD guard, and what this Issue adds — the sections, the denials, the
 * contact method — is a different subject rather than a correction of it.
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
      level: 1,
    });

  // ui-design.md section 8: one h1 per page. Counted rather than located, so
  // the test can show the disclosure did not arrive as a second page title.
  const topLevelHeadings = () => page.getByRole("heading", { level: 1 });

  const firstPartySection = () =>
    page.getByRole("region", {
      name: privacySelectors.firstPartySectionLabel,
    });

  const thirdPartySection = () =>
    page.getByRole("region", {
      name: privacySelectors.thirdPartySectionLabel,
    });

  /**
   * The Zipnami-storage section, when it states the given thing.
   *
   * Filtering the section rather than locating the sentence keeps the
   * assertion off the markup: a text locator also matches every ancestor that
   * contains the text, so a count would measure wrappers. A section resolves
   * to exactly one element, so this resolves to one when the statement is
   * inside it and to nothing when it is not.
   * @param statement - What the section has to state.
   */
  const firstPartySectionStating = (statement: RegExp) =>
    firstPartySection().filter({ hasText: statement });

  /**
   * The third-party section, when it states the given thing.
   * @param statement - What the section has to state.
   */
  const thirdPartySectionStating = (statement: RegExp) =>
    thirdPartySection().filter({ hasText: statement });

  const contactLink = () =>
    main().getByRole("link", { name: privacySelectors.contactLabel });

  const contactDestination = () => contactLink().getAttribute("href");

  const focusContactLink = () => contactLink().focus();

  /*
   * Whether the contact link is in the document's tab order.
   *
   * Focusing it proves only that focus can be put there, which is also true of
   * an element removed from the tab order, so the property that decides
   * reachability is read directly. A Tab-key traversal would have been the
   * more direct measurement, but it answers a browser setting rather than an
   * application contract: WebKit does not move Tab focus to links unless full
   * keyboard access is switched on, which was measured across this suite's
   * five projects before this file was written.
   */
  const contactLinkTabIndex = () =>
    contactLink().evaluate((element) => element.tabIndex);

  const disclosureLink = () =>
    page.getByRole("link", { name: privacySelectors.disclosureLink });

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
    page.getByText(privacySelectors.japanPostCredit).first();

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
    firstPartySection,
    thirdPartySection,
    firstPartySectionStating,
    thirdPartySectionStating,
    contactLink,
    contactDestination,
    focusContactLink,
    contactLinkTabIndex,
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
