import { test as base } from "@playwright/test";
import {
  createGeneratorPage,
  type GeneratorPage,
} from "../pages/generator-page.ts";
import { createPrivacyPage, type PrivacyPage } from "../pages/privacy-page.ts";

type AcceptanceFixtures = {
  generatorPage: GeneratorPage;
  privacyPage: PrivacyPage;
};

/**
 * Entry point for every acceptance test.
 *
 * Page Objects are exposed as fixtures so a test states what the user does, and
 * the browser calls that carry it out stay in one place per screen.
 */
export const test = base.extend<AcceptanceFixtures>({
  generatorPage: async ({ page }, use) => {
    await use(createGeneratorPage(page));
  },
  privacyPage: async ({ page }, use) => {
    await use(createPrivacyPage(page));
  },
});

export { expect } from "@playwright/test";
