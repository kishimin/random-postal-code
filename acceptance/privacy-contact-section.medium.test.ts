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
  createPrivacyContactPage,
  type PrivacyContactPage,
} from "./pages/privacy-contact-page.ts";
import {
  createPrivacyDisclosurePage,
  type PrivacyDisclosurePage,
} from "./pages/privacy-disclosure-page.ts";
import { privacyContactSelectors } from "./selectors/privacy-contact-selectors.ts";

/*
 * Acceptance test for Issue #105: Add a Google Form contact link to the
 * privacy page.
 *
 * Each test name states the acceptance criterion it holds, numbered as the
 * Issue lists them.
 *
 * Held here: AC-2, the 「5. お問い合わせ」 section and its one link to the
 * form; AC-3, the link in the Tab order, with a visible focus indicator, and
 * opened by Enter; and the page half of AC-4, that the section says the form
 * is a Google service and how what is entered is used.
 *
 * Held elsewhere: the privacy page's whole link inventory and its axe-core
 * scan are the #16 accessibility test's, and its link count is the #112
 * test's. Both were rewritten for this link with the owner's approval on
 * Issue #105 (ADR-0080).
 *
 * Not held: AC-1 and AC-6 were done against the live form and Discord and
 * are recorded on the Issue; AC-5 is the contact-form script's own test. The
 * contract half of AC-4 (design.md section 8 and ui-design.md) and AC-7 (no
 * credential in a commit, Issue, PR, or CI output) are settled by review of
 * the change, as Issue #112's contract update was.
 *
 * Nothing here contacts Google. Advertising requests are refused, and the
 * form's address is answered by a stand-in page.
 */

type Fixtures = {
  accessibilityPage: AccessibilityPage;
  advertisingPage: AdvertisingPage;
  privacyContactPage: PrivacyContactPage;
  privacyDisclosurePage: PrivacyDisclosurePage;
};

const test = shellTest.extend<Fixtures>({
  accessibilityPage: async ({ page }, use) => {
    await use(createAccessibilityPage(page));
  },
  advertisingPage: async ({ page }, use) => {
    await use(createAdvertisingPage(page));
  },
  privacyContactPage: async ({ page }, use) => {
    await use(createPrivacyContactPage(page));
  },
  privacyDisclosurePage: async ({ page }, use) => {
    await use(createPrivacyDisclosurePage(page));
  },
});

test.describe("Issue #105: the privacy page links to the Google contact form", () => {
  test.beforeEach(
    async ({ advertisingPage, privacyContactPage, privacyDisclosurePage }) => {
      await advertisingPage.failEveryAdvertisingRequest();
      await privacyContactPage.answerFormWithStandIn();
      await privacyDisclosurePage.navigate();
      await expect(privacyDisclosurePage.heading()).toBeVisible();
    },
  );

  test("AC-2 /privacy ends with a section headed 5. お問い合わせ whose one link goes to the form", async ({
    privacyContactPage,
  }) => {
    await expect(privacyContactPage.section()).toBeVisible();
    await expect(privacyContactPage.headingOfSection()).toBeVisible();
    expect((await privacyContactPage.sectionHeadingsInOrder()).at(-1)).toBe(
      privacyContactSelectors.sectionHeading,
    );

    await expect(privacyContactPage.linksInSection()).toHaveCount(1);
    await expect(privacyContactPage.contactLink()).toHaveAttribute(
      "href",
      privacyContactSelectors.formUrl,
    );
  });

  test("AC-3 the link is in the Tab order, shows focus, and Enter opens the form", async ({
    accessibilityPage,
    privacyContactPage,
  }) => {
    const link = privacyContactPage.contactLink();

    expect(await accessibilityPage.tabIndexOf(link)).toBeGreaterThanOrEqual(0);
    expect(await accessibilityPage.showsFocusIndicator(link)).toBe(true);

    await accessibilityPage.operateWithKey(link, "Enter");

    await expect
      .poll(() => privacyContactPage.currentUrl())
      .toBe(privacyContactSelectors.formUrl);
  });

  test("AC-4 the section says the form is a Google service and how what is entered is used", async ({
    privacyContactPage,
  }) => {
    await expect(
      privacyContactPage.sectionStating(
        privacyContactSelectors.formIsGoogleService,
      ),
    ).toHaveCount(1);
    await expect(
      privacyContactPage.sectionStating(privacyContactSelectors.howInputIsUsed),
    ).toHaveCount(1);
  });
});
