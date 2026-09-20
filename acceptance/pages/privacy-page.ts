import type { Page } from "@playwright/test";
import { shellSelectors } from "../selectors/shell-selectors.ts";

/**
 * Page Object for the Privacy route.
 *
 * `navigate` loads the route directly rather than following a link, because the
 * acceptance criterion under test is that a deep link resolves through the SPA
 * fallback instead of returning a 404.
 * @param page - The Playwright page driving the browser.
 */
export const createPrivacyPage = (page: Page) => {
  const navigate = () => page.goto("/privacy");

  const heading = () =>
    page.getByRole("heading", {
      name: shellSelectors.privacyHeading,
      level: 1,
    });

  const main = () => page.getByRole("main");

  return { navigate, heading, main };
};

export type PrivacyPage = ReturnType<typeof createPrivacyPage>;
