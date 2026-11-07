import { expect, test as shellTest } from "./fixtures";
import {
  type AccessibilityPage,
  createAccessibilityPage,
} from "./pages/accessibility-page.ts";
import {
  type AdvertisingPage,
  createAdvertisingPage,
} from "./pages/advertising-page.ts";
import {
  createPostalCodeGeneratorPage,
  type PostalCodeGeneratorPage,
} from "./pages/postal-code-generator-page.ts";
import {
  createPrivacyDisclosurePage,
  type PrivacyDisclosurePage,
} from "./pages/privacy-disclosure-page.ts";
import { figmaCopy } from "./selectors/figma-copy.ts";
import { privacyFooterSelectors } from "./selectors/privacy-footer-selectors.ts";

/*
 * Acceptance test for Issue #112: Turn the privacy page's footer link into a
 * link home.
 *
 * Each test name states the acceptance criterion it holds.
 *
 * Held here: the link home on /privacy, activated by pointer and by keyboard,
 * and where focus lands; no link to the page the visitor is already on; and
 * the unchanged footer link on the generator and the not-found screen.
 *
 * Held elsewhere: the privacy page's link inventory, Tab reachability, focus
 * indicator, and axe-core scan at every width are the #16 accessibility
 * test's (`web-responsive-accessibility.medium.test.ts`), rewritten for
 * ホームに戻る with the owner's approval on Issue #112.
 *
 * Not held: the global error screen. A browser cannot be driven to the render
 * failure that shows it (ui-design.md section 10), so its footer is held by
 * the frontend's own tests. The contract update to docs/ui-design.md is
 * settled by review of the change.
 */

type Fixtures = {
  accessibilityPage: AccessibilityPage;
  advertisingPage: AdvertisingPage;
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
  privacyDisclosurePage: PrivacyDisclosurePage;
};

const test = shellTest.extend<Fixtures>({
  accessibilityPage: async ({ page }, use) => {
    await use(createAccessibilityPage(page));
  },
  advertisingPage: async ({ page }, use) => {
    await use(createAdvertisingPage(page));
  },
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
  privacyDisclosurePage: async ({ page }, use) => {
    await use(createPrivacyDisclosurePage(page));
  },
});

test.describe("Issue #112: the privacy page's footer link goes home", () => {
  test.beforeEach(async ({ advertisingPage }) => {
    await advertisingPage.failEveryAdvertisingRequest();
  });

  test("on /privacy, ホームに戻る activated by pointer shows the generator at / with focus on its heading", async ({
    accessibilityPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.heading()).toBeVisible();

    await accessibilityPage.linkNamed(privacyFooterSelectors.homeLink).click();

    await expect.poll(() => accessibilityPage.currentPath()).toBe("/");
    await expect(postalCodeGeneratorPage.brandingHeading()).toBeVisible();
    await expect(postalCodeGeneratorPage.brandingHeading()).toBeFocused();
  });

  test("on /privacy, ホームに戻る activated by keyboard shows the generator at / with focus on its heading", async ({
    accessibilityPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.heading()).toBeVisible();

    await accessibilityPage.operateWithKey(
      accessibilityPage.linkNamed(privacyFooterSelectors.homeLink),
      "Enter",
    );

    await expect.poll(() => accessibilityPage.currentPath()).toBe("/");
    await expect(postalCodeGeneratorPage.brandingHeading()).toBeVisible();
    await expect(postalCodeGeneratorPage.brandingHeading()).toBeFocused();
  });

  test("on /privacy, the frame's links are ZIPNAMI and ホームに戻る, and none is named プライバシーポリシー", async ({
    accessibilityPage,
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.heading()).toBeVisible();

    await expect(
      accessibilityPage.controlsNamed("link", figmaCopy.privacyLink),
    ).toHaveCount(0);
    await expect(
      accessibilityPage.controlsNamed("link", figmaCopy.wordmark),
    ).toHaveCount(1);
    await expect(
      accessibilityPage.controlsNamed("link", privacyFooterSelectors.homeLink),
    ).toHaveCount(1);
    await expect(accessibilityPage.controls("link")).toHaveCount(2);
  });

  test("on the generator, the footer link is still プライバシーポリシー and opens /privacy", async ({
    accessibilityPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await postalCodeGeneratorPage.navigate();
    await expect(postalCodeGeneratorPage.generateAction()).toBeVisible();
    await expect(
      accessibilityPage.controlsNamed("link", privacyFooterSelectors.homeLink),
    ).toHaveCount(0);

    await postalCodeGeneratorPage.navigationLink().click();

    await expect.poll(() => accessibilityPage.currentPath()).toBe("/privacy");
    await expect(privacyDisclosurePage.heading()).toBeVisible();
  });

  test("on the not-found screen, the footer link is still プライバシーポリシー and opens /privacy", async ({
    accessibilityPage,
    privacyDisclosurePage,
  }) => {
    await accessibilityPage.navigate("/no-such-page-112");
    await expect(
      accessibilityPage.controlsNamed("link", figmaCopy.backToTop),
    ).toBeVisible();
    await expect(
      accessibilityPage.controlsNamed("link", privacyFooterSelectors.homeLink),
    ).toHaveCount(0);

    await accessibilityPage
      .controlsNamed("link", figmaCopy.privacyLink)
      .click();

    await expect.poll(() => accessibilityPage.currentPath()).toBe("/privacy");
    await expect(privacyDisclosurePage.heading()).toBeVisible();
  });
});
