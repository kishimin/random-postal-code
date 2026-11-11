import { expect, test as shellTest } from "./fixtures";
import {
  createAdvertisingPage,
  type AdvertisingPage,
} from "./pages/advertising-page.ts";
import { createGuidePage, type GuidePage } from "./pages/guide-page.ts";
import {
  createGuideBackToTopPage,
  type GuideBackToTopPage,
} from "./pages/guide-back-to-top-page.ts";
import {
  createPostalCodeGeneratorPage,
  type PostalCodeGeneratorPage,
} from "./pages/postal-code-generator-page.ts";
import { figmaCopy } from "./selectors/figma-copy.ts";
import { guides } from "./selectors/guide-selectors.ts";

/*
 * Acceptance test for Issue #121's criterion added on 2026-11-11: each of the
 * five guide pages ends with one トップへ戻る link that opens `/`.
 *
 * The owner found the header logo was the only way home from a guide page and
 * chose a link at the end of the article only:
 * https://github.com/kishimin/random-postal-code/issues/121#issuecomment-6781060802
 *
 * Held here, for every guide page:
 *
 * - main carries exactly one link named トップへ戻る, the not-found screen's
 *   words, and it is the last link in main, so it follows the sources;
 * - neither the header nor the footer carries one;
 * - following it opens the generator at `/`, not the not-found screen.
 *
 * Not held here: that the generator, result, error, /privacy and not-found
 * screens are unchanged. Their link lists are already pinned by name and
 * count in web-responsive-accessibility.medium.test.ts (AC-3), so a stray
 * トップへ戻る there fails that test. The footer's ガイド navigation is pinned
 * in web-guide-pages.medium.test.ts (AC-8). The link's appearance is the PR's
 * screenshots (ADR-0012).
 *
 * Nothing here contacts Google: advertising requests are refused, as in the
 * Issue #121 guide-page test.
 */

const test = shellTest.extend<{
  advertisingPage: AdvertisingPage;
  guideBackToTopPage: GuideBackToTopPage;
  guidePage: GuidePage;
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
}>({
  advertisingPage: async ({ page }, use) => {
    await use(createAdvertisingPage(page));
  },
  guideBackToTopPage: async ({ page }, use) => {
    await use(createGuideBackToTopPage(page));
  },
  guidePage: async ({ page }, use) => {
    await use(createGuidePage(page));
  },
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
});

test.describe("Issue #121: each guide page ends with a トップへ戻る link to the generator", () => {
  test.beforeEach(async ({ advertisingPage }) => {
    await advertisingPage.failEveryAdvertisingRequest();
  });

  for (const guide of guides) {
    test(`${guide.path}: the last link in main is the one トップへ戻る, the header and footer carry none, and it opens the generator`, async ({
      guideBackToTopPage,
      guidePage,
      postalCodeGeneratorPage,
    }) => {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      await expect(guideBackToTopPage.backToTopLinks()).toHaveCount(1);
      await expect(guideBackToTopPage.backToTopLinks()).toBeVisible();
      expect(await guideBackToTopPage.lastLinkInMainName()).toBe(
        figmaCopy.backToTop,
      );
      await expect(guideBackToTopPage.headerBackToTopLinks()).toHaveCount(0);
      await expect(guideBackToTopPage.footerBackToTopLinks()).toHaveCount(0);

      await guideBackToTopPage.followBackToTop();

      await expect(postalCodeGeneratorPage.startAction()).toBeVisible();
      expect(guideBackToTopPage.currentPath()).toBe("/");
      await expect(guidePage.notFoundHeading()).toHaveCount(0);
    });
  }
});
