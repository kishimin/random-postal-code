import { expect, test as shellTest } from "./fixtures";
import {
  createAdvertisingPage,
  type AdvertisingPage,
} from "./pages/advertising-page.ts";
import {
  createPrivacyDisclosurePage,
  type PrivacyDisclosurePage,
} from "./pages/privacy-disclosure-page.ts";
import { mobileAppPrivacySelectors } from "./selectors/mobile-app-privacy-selectors.ts";
import { privacySelectors } from "./selectors/privacy-selectors.ts";

/*
 * Acceptance test for Issue #20, AC-4 and AC-6: the privacy policy whose URL
 * the Google Play listing gives describes the Android app.
 *
 * The listing links the Web site's /privacy, the one policy Zipnami has. Play
 * requires that policy to cover the app it is listed for, so the page has to
 * say what the app does that the Web site does not: it shows a Google AdMob
 * banner, which reads the device's advertising ID; it asks for consent before
 * ads where that is required; and it keeps the history on the device.
 *
 * Each statement is held inside the section of Figma's headings it belongs
 * under, as Issue #10's test does, and only as a statement on the page. That
 * the page is publicly reachable on the deployed site is the release
 * checklist's (docs/google-play-release-checklist.md), because only the
 * deployed site can show it. Whether the wording is legally sufficient is not
 * held here.
 *
 * Nothing here contacts Google: every advertising request is refused first.
 */

const test = shellTest.extend<{
  advertisingPage: AdvertisingPage;
  privacyDisclosurePage: PrivacyDisclosurePage;
}>({
  advertisingPage: async ({ page }, use) => {
    await use(createAdvertisingPage(page));
  },
  privacyDisclosurePage: async ({ page }, use) => {
    await use(createPrivacyDisclosurePage(page));
  },
});

const { advertisingAndAnalytics, history } = privacySelectors.sectionHeadings;

test.describe("Issue #20: the privacy policy covers the Android app", () => {
  test.beforeEach(async ({ advertisingPage, privacyDisclosurePage }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.heading()).toBeVisible();
  });

  test("AC-4 the policy names the Android app", async ({
    privacyDisclosurePage,
  }) => {
    await expect(
      privacyDisclosurePage
        .main()
        .filter({ hasText: mobileAppPrivacySelectors.androidApp }),
    ).toHaveCount(1);
  });

  test("AC-6 the advertising section says the app shows Google AdMob ads that use the advertising ID", async ({
    privacyDisclosurePage,
  }) => {
    await expect(
      privacyDisclosurePage.sectionStating(
        advertisingAndAnalytics,
        mobileAppPrivacySelectors.adMob,
      ),
    ).toHaveCount(1);
    await expect(
      privacyDisclosurePage.sectionStating(
        advertisingAndAnalytics,
        mobileAppPrivacySelectors.advertisingId,
      ),
    ).toHaveCount(1);
  });

  test("AC-6 the advertising section says the app asks for consent before ads", async ({
    privacyDisclosurePage,
  }) => {
    await expect(
      privacyDisclosurePage.sectionStating(
        advertisingAndAnalytics,
        mobileAppPrivacySelectors.appConsent,
      ),
    ).toHaveCount(1);
  });

  test("AC-4 the history section says the app keeps its history on the device", async ({
    privacyDisclosurePage,
  }) => {
    await expect(
      privacyDisclosurePage.sectionStating(
        history,
        mobileAppPrivacySelectors.appHistoryOnDevice,
      ),
    ).toHaveCount(1);
  });
});
