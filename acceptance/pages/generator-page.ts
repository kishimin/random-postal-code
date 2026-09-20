import type { Page } from "@playwright/test";
import { narrowPhoneViewport } from "../selectors/shell-selectors.ts";

/**
 * Page Object for the Generator route.
 *
 * Only the shell is addressed here. Generating a postal code, the result, the
 * map, and history belong to Issues #6 through #9 and are out of scope for the
 * acceptance test of Issue #5.
 * @param page - The Playwright page driving the browser.
 */
export const createGeneratorPage = (page: Page) => {
  const navigate = () => page.goto("/");

  const main = () => page.getByRole("main");

  const documentTitle = () => page.title();

  const resizeToNarrowPhone = () => page.setViewportSize(narrowPhoneViewport);

  // Compares the document's scrollable width against its visible width. A
  // larger scrollWidth means content overflows horizontally, which ui-design.md
  // section 5.1 forbids for primary content at this viewport.
  const hasHorizontalOverflow = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

  return {
    navigate,
    main,
    documentTitle,
    resizeToNarrowPhone,
    hasHorizontalOverflow,
  };
};

export type GeneratorPage = ReturnType<typeof createGeneratorPage>;
