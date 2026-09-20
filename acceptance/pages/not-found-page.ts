import type { Page } from "@playwright/test";
import { chromeSelectors, unknownPath } from "../selectors/chrome-selectors.ts";

/**
 * Page Object for the destination an unknown path reaches.
 *
 * `navigate` requests a path no route claims, which is the condition under
 * test: the SPA fallback serves index.html for it, and the router must answer
 * with the not-found screen rather than the generator.
 */
export const createNotFoundPage = (page: Page) => {
  const navigate = () => page.goto(unknownPath);

  const heading = () =>
    page.getByRole("heading", {
      name: chromeSelectors.notFoundHeading,
      level: 1,
    });

  const backToGeneratorLink = () =>
    page.getByRole("link", { name: chromeSelectors.backToGenerator });

  const header = () => page.getByRole("banner");

  const footer = () => page.getByRole("contentinfo");

  const attribution = () =>
    page.getByRole("contentinfo").getByText(chromeSelectors.attribution);

  const hasHorizontalOverflow = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

  return {
    navigate,
    heading,
    backToGeneratorLink,
    header,
    footer,
    attribution,
    hasHorizontalOverflow,
  };
};

export type NotFoundPage = ReturnType<typeof createNotFoundPage>;
