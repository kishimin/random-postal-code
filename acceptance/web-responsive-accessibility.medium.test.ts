import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  createAccessibilityPage,
  type AccessibilityPage,
} from "./pages/accessibility-page.ts";
import {
  createAdvertisingPage,
  type AdvertisingPage,
} from "./pages/advertising-page.ts";
import {
  createPostalCodeGeneratorPage,
  respondUnavailable,
  respondWith,
  type PostalCodeGeneratorPage,
} from "./pages/postal-code-generator-page.ts";
import {
  createPrivacyDisclosurePage,
  type PrivacyDisclosurePage,
} from "./pages/privacy-disclosure-page.ts";
import {
  copySuccessText,
  documentTitleSelectors,
  failureText,
  loadingText,
  representativeViewports,
  resultHeadingName,
} from "./selectors/accessibility-selectors.ts";
import { advertisingSelectors } from "./selectors/advertising-selectors.ts";
import { chromeSelectors, unknownPath } from "./selectors/chrome-selectors.ts";
import { displayedPostalCode } from "./selectors/generator-selectors.ts";

/*
 * Acceptance test for Issue #16: Meet Web responsive and accessibility
 * requirements.
 *
 * Each test name starts with the acceptance criterion it holds (AC-1 through
 * AC-8, in the Issue's order), so a failure names the criterion that broke
 * rather than only the assertion.
 *
 *   AC-1  Web works at representative mobile, tablet, and desktop widths
 *         without hidden primary controls or horizontal content loss.
 *   AC-2  Web primary actions are keyboard operable with visible focus.
 *   AC-3  Buttons and links have meaningful accessible names.
 *   AC-4  Status, loading, result, and error information is not conveyed by
 *         color alone.
 *   AC-5  Dynamic results and errors are announced appropriately.
 *   AC-6  Semantic HTML landmarks and controls are used on Web.
 *   AC-7  Advertisement areas are distinguishable from application content.
 *   AC-8  Automated accessibility checks cover stable Web states, with manual
 *         checks documented for remaining Web behavior.
 *
 * The screens are the ones the Web MVP ships today: the generator in each of
 * its stable states (idle, loading, success, error), the privacy page, and the
 * not-found destination. Maps and history are not exercised: Issues #7 and #8
 * have not delivered them, and verifying a screen that does not exist would
 * pull this Issue into building it. Those Issues' own acceptance tests are
 * where their regions' headings and names are held. The global error screen
 * is not exercised either: a browser cannot provoke a render failure without
 * a route built to throw, and Issue #26's router-boundary tests hold that
 * screen's focus and announcement instead.
 *
 * The Issue's Out of scope section — Android V2, and visual redesign unrelated
 * to accessibility or responsive behavior — is deliberately untouched.
 *
 * Several criteria are held in a narrower form than their wording, and the
 * difference is deliberate.
 *
 * "Without hidden primary controls or horizontal content loss" (AC-1) is held
 * as geometry against the visible width: no horizontal scrolling, every
 * primary control and every address inside the visible width, and no address
 * clipped inside its own box. Whether the layout looks right at each width is
 * an appearance judgement this repository keeps out of automated tests
 * (ADR-0012). ui-design.md section 10 also lists 200% browser zoom and text
 * enlargement; neither can be driven the same way in every engine of this
 * suite, so they are manual checks. The narrowest widths here are what a
 * 640px-wide window at 200% zoom lays out at, which covers the reflow half.
 *
 * "Visible focus" (AC-2) is held by comparing each control with itself, before
 * and after it takes keyboard focus: the pictures must differ. That fixes that
 * an indicator exists, not what it looks like, so no appearance becomes an
 * expectation. Whether the indicator has enough contrast is a manual check.
 *
 * "Not conveyed by color alone" (AC-4) is held in its positive form: each
 * status is also stated in visible text or an accessibility state. Proving
 * that colour carries no additional meaning would mean reading colours, which
 * ADR-0012 forbids and which would still not show what a visitor perceives.
 *
 * "Announced appropriately" (AC-5) is held as what reaches a live region, and
 * where focus is left. Whether a particular screen reader then speaks it, and
 * whether unchanged content is repeated, depends on the assistive technology
 * and is a manual check. The route-change check answers review finding CR-006
 * of Issue #10: arriving at another page has to be perceivable, by focus or by
 * announcement, and the document title has to name the page.
 *
 * "Distinguishable" (AC-7) is held as structure a visitor can perceive: one
 * labelled region, a label they can read, and no application content inside
 * it. Review finding CR-004 of Issue #9 asks for a visual boundary as well;
 * a border or a background is appearance, so it is a manual check, not an
 * assertion here.
 *
 * AC-8 is held for its automated half only. The axe-core scan below runs over
 * every stable state on every project in this suite. "Manual checks
 * documented for remaining Web behavior" describes a document the repository
 * contains, and a browser cannot observe that; it is settled by review of the
 * change, the same way Issue #6's acceptance test leaves "which tests exist"
 * to the package's own suite.
 *
 * Nothing here contacts Google. The generator screen loads the AdSense tag, so
 * every test that visits it answers advertising and consent requests at the
 * network boundary first, the same way Issue #9's acceptance test does.
 * `GET /api/random` is stubbed for the same reason Issue #6's test stubs it.
 */

/**
 * Finds a postal code in the shared acceptance dataset.
 * @param postalCode - The canonical seven-digit code to look up.
 */
const datasetEntry = (postalCode: string): PostalCode => {
  const entry = normalizedPostalCodes.find(
    (candidate) => candidate.postalCode === postalCode,
  );

  if (!entry) {
    throw new Error(`The acceptance dataset has no postal code ${postalCode}.`);
  }

  return entry;
};

// Two addresses, so "every address stays visible" is more than one element.
const result = datasetEntry("3670030");
const secondResult = datasetEntry("4980000");

/*
 * A result whose address is far longer than anything in the dataset.
 *
 * This is not real Japan Post data; it is a stress input for AC-1. Real town
 * names run to dozens of characters when a range of blocks is spelled out,
 * and a narrow phone has to show all of one without widening the page or
 * cutting it off. The digits and a Latin run are included because they are
 * the characters most likely not to wrap where Japanese text would.
 */
const longAddressResult: PostalCode = {
  postalCode: "0600000",
  addresses: [
    {
      prefecture: "北海道",
      city: "札幌市中央区",
      town: "大通西（１～１９丁目、２０丁目１番地～２８丁目３番地）ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    },
    ...result.addresses,
  ],
};

/*
 * Extends the shell fixture rather than editing it.
 *
 * ./fixtures/index.ts and ./fixtures/test.ts are committed, and the ATDD guard
 * locks a committed file under acceptance/ so an implementation cannot quietly
 * reshape the test it must satisfy. Adding a Page Object for a new Issue is not
 * that, but the guard cannot tell the two apart, so the fixture composes here.
 */
const test = shellTest.extend<{
  accessibilityPage: AccessibilityPage;
  advertisingPage: AdvertisingPage;
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
  privacyDisclosurePage: PrivacyDisclosurePage;
}>({
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

test.describe("Issue #16: Web responsive and accessibility requirements", () => {
  for (const viewport of representativeViewports) {
    test(`AC-1 at ${viewport.name}, the generator's primary controls and every address stay within the visible width`, async ({
      accessibilityPage,
      advertisingPage,
      postalCodeGeneratorPage,
    }) => {
      await advertisingPage.substituteAdvertisingSdk();
      await postalCodeGeneratorPage.stubRandomEndpoint([
        respondWith(longAddressResult),
      ]);
      await accessibilityPage.resizeTo(viewport);
      await postalCodeGeneratorPage.navigate();
      await postalCodeGeneratorPage.generate();

      await expect(
        postalCodeGeneratorPage.postalCodeDisplay(longAddressResult.postalCode),
      ).toBeVisible();

      expect(await accessibilityPage.hasHorizontalOverflow()).toBe(false);

      for (const control of [
        postalCodeGeneratorPage.generateAction(),
        postalCodeGeneratorPage.copyAction(),
        accessibilityPage.linkNamed(chromeSelectors.siteHeader),
        postalCodeGeneratorPage.navigationLink(),
        accessibilityPage.visibleTextInMain(
          new RegExp(displayedPostalCode(longAddressResult.postalCode)),
        ),
        advertisingPage.advertisingRegion(),
      ]) {
        expect(await accessibilityPage.liesWithinVisibleWidth(control)).toBe(
          true,
        );
      }

      // Every address, not only the first: the criterion is about content
      // loss, and the entry most likely to be lost is the longest one.
      for (const address of longAddressResult.addresses) {
        const entry = postalCodeGeneratorPage.addressEntry(address);
        expect(await accessibilityPage.liesWithinVisibleWidth(entry)).toBe(
          true,
        );
        expect(await accessibilityPage.showsAllOfItsText(entry)).toBe(true);
      }
    });

    test(`AC-1 at ${viewport.name}, a failed generation's message and its retry stay within the visible width`, async ({
      accessibilityPage,
      advertisingPage,
      postalCodeGeneratorPage,
    }) => {
      await advertisingPage.failEveryAdvertisingRequest();
      await postalCodeGeneratorPage.stubRandomEndpoint([respondUnavailable()]);
      await accessibilityPage.resizeTo(viewport);
      await postalCodeGeneratorPage.navigate();
      await postalCodeGeneratorPage.generate();

      const failure = accessibilityPage.visibleTextInMain(failureText);
      await expect(failure).toBeVisible();

      expect(await accessibilityPage.hasHorizontalOverflow()).toBe(false);
      expect(await accessibilityPage.liesWithinVisibleWidth(failure)).toBe(
        true,
      );
      expect(
        await accessibilityPage.liesWithinVisibleWidth(
          postalCodeGeneratorPage.generateAction(),
        ),
      ).toBe(true);
    });

    test(`AC-1 at ${viewport.name}, the privacy page's sections and contact method stay within the visible width`, async ({
      accessibilityPage,
      privacyDisclosurePage,
    }) => {
      await accessibilityPage.resizeTo(viewport);
      await privacyDisclosurePage.navigate();

      await expect(privacyDisclosurePage.heading()).toBeVisible();
      expect(await accessibilityPage.hasHorizontalOverflow()).toBe(false);

      for (const element of [
        privacyDisclosurePage.heading(),
        privacyDisclosurePage.firstPartySection(),
        privacyDisclosurePage.thirdPartySection(),
        privacyDisclosurePage.contactLink(),
        accessibilityPage.linkNamed(chromeSelectors.siteHeader),
        privacyDisclosurePage.disclosureLink(),
      ]) {
        expect(await accessibilityPage.liesWithinVisibleWidth(element)).toBe(
          true,
        );
      }
    });

    test(`AC-1 at ${viewport.name}, the not-found screen's way back stays within the visible width`, async ({
      accessibilityPage,
      notFoundPage,
    }) => {
      await accessibilityPage.resizeTo(viewport);
      await notFoundPage.navigate();

      await expect(notFoundPage.heading()).toBeVisible();
      expect(await accessibilityPage.hasHorizontalOverflow()).toBe(false);
      expect(
        await accessibilityPage.liesWithinVisibleWidth(
          notFoundPage.backToGeneratorLink(),
        ),
      ).toBe(true);
    });
  }

  test("AC-2 the generate action works from Enter and from Space, and the copy action from Enter", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.recordClipboardWrites();
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(result),
      respondWith(secondResult),
    ]);
    await postalCodeGeneratorPage.navigate();

    await accessibilityPage.operateWithKey(
      postalCodeGeneratorPage.generateAction(),
      "Enter",
    );
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();

    // Space as well as Enter: a native button answers both, and a control
    // that only looks like one usually answers neither or only Enter. That is
    // also what AC-6's "semantic controls" means to a keyboard user.
    await accessibilityPage.operateWithKey(
      postalCodeGeneratorPage.generateAction(),
      " ",
    );
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(secondResult.postalCode),
    ).toBeVisible();

    await accessibilityPage.operateWithKey(
      postalCodeGeneratorPage.copyAction(),
      "Enter",
    );
    await expect
      .poll(() => postalCodeGeneratorPage.clipboardWrites())
      .toContain(secondResult.postalCode);
  });

  test("AC-2 the header, footer, and not-found links each work from Enter", async ({
    accessibilityPage,
    advertisingPage,
    notFoundPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.navigate();

    await accessibilityPage.operateWithKey(
      postalCodeGeneratorPage.navigationLink(),
      "Enter",
    );
    await expect.poll(() => accessibilityPage.currentPath()).toBe("/privacy");

    await accessibilityPage.operateWithKey(
      accessibilityPage.linkNamed(chromeSelectors.siteHeader),
      "Enter",
    );
    await expect.poll(() => accessibilityPage.currentPath()).toBe("/");

    await notFoundPage.navigate();
    await accessibilityPage.operateWithKey(
      notFoundPage.backToGeneratorLink(),
      "Enter",
    );
    await expect.poll(() => accessibilityPage.currentPath()).toBe("/");
  });

  test("AC-2 every primary control is in the tab order, and nothing jumps ahead of the document order", async ({
    accessibilityPage,
    advertisingPage,
    notFoundPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();
    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();

    for (const control of [
      postalCodeGeneratorPage.generateAction(),
      postalCodeGeneratorPage.copyAction(),
      accessibilityPage.linkNamed(chromeSelectors.siteHeader),
      postalCodeGeneratorPage.navigationLink(),
    ]) {
      expect(
        await accessibilityPage.tabIndexOf(control),
      ).toBeGreaterThanOrEqual(0);
    }
    expect(await accessibilityPage.elementsAheadOfDocumentOrder()).toBe(0);

    await privacyDisclosurePage.navigate();
    expect(
      await accessibilityPage.tabIndexOf(privacyDisclosurePage.contactLink()),
    ).toBeGreaterThanOrEqual(0);
    expect(await accessibilityPage.elementsAheadOfDocumentOrder()).toBe(0);

    await notFoundPage.navigate();
    expect(
      await accessibilityPage.tabIndexOf(notFoundPage.backToGeneratorLink()),
    ).toBeGreaterThanOrEqual(0);
    expect(await accessibilityPage.elementsAheadOfDocumentOrder()).toBe(0);
  });

  test("AC-2 every primary control shows a visible change when it takes keyboard focus", async ({
    accessibilityPage,
    advertisingPage,
    notFoundPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generateWithKeyboard();
    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();

    for (const control of [
      postalCodeGeneratorPage.generateAction(),
      postalCodeGeneratorPage.copyAction(),
      accessibilityPage.linkNamed(chromeSelectors.siteHeader),
      postalCodeGeneratorPage.navigationLink(),
    ]) {
      expect(await accessibilityPage.showsFocusIndicator(control)).toBe(true);
    }

    await privacyDisclosurePage.navigate();
    expect(
      await accessibilityPage.showsFocusIndicator(
        privacyDisclosurePage.contactLink(),
      ),
    ).toBe(true);

    await notFoundPage.navigate();
    expect(
      await accessibilityPage.showsFocusIndicator(
        notFoundPage.backToGeneratorLink(),
      ),
    ).toBe(true);
  });

  test("AC-3 every button and link on each screen and state has a meaningful accessible name", async ({
    accessibilityPage,
    advertisingPage,
    notFoundPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(result),
      respondUnavailable(),
    ]);

    /*
     * Every control has to carry one of the names a visitor recognises it by.
     * Counting all of them against the named ones means an unnamed or
     * generically named control — an icon button with no label, a link
     * reading "こちら" — leaves the two counts different. The link count is
     * required to be non-zero so the equality cannot hold for a screen that
     * failed to render at all.
     */
    const expectEveryControlNamed = async () => {
      const linkCount = await accessibilityPage.links().count();
      expect(linkCount).toBeGreaterThan(0);
      await expect(accessibilityPage.namedLinks()).toHaveCount(linkCount);
      await expect(accessibilityPage.namedButtons()).toHaveCount(
        await accessibilityPage.buttons().count(),
      );
    };

    // Idle.
    await postalCodeGeneratorPage.navigate();
    await expect(postalCodeGeneratorPage.generateAction()).toBeVisible();
    await expectEveryControlNamed();

    // Success, where the copy action joins the screen.
    await postalCodeGeneratorPage.generate();
    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();
    await expectEveryControlNamed();

    // Error, where the previous result stays and the retry is offered.
    await postalCodeGeneratorPage.generate();
    await expect(
      accessibilityPage.visibleTextInMain(failureText),
    ).toBeVisible();
    await expectEveryControlNamed();

    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.contactLink()).toBeVisible();
    await expectEveryControlNamed();

    await notFoundPage.navigate();
    await expect(notFoundPage.backToGeneratorLink()).toBeVisible();
    await expectEveryControlNamed();
  });

  test("AC-4 loading is stated in visible text and a busy state, not only by a greyed-out action", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();

    postalCodeGeneratorPage.holdResponses();
    await postalCodeGeneratorPage.generate();

    await expect(postalCodeGeneratorPage.generateAction()).toBeDisabled();
    await expect(
      accessibilityPage.visibleTextInMain(loadingText),
    ).toBeVisible();
    // ui-design.md section 8: aria-busy on the result region during
    // generation, which is how assistive technology learns the region is
    // about to change without the change being announced twice.
    await expect(accessibilityPage.busyRegions()).toHaveCount(1);

    postalCodeGeneratorPage.releaseResponses();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();
    await expect(accessibilityPage.busyRegions()).toHaveCount(0);
  });

  test("AC-4 a failed generation is stated in visible text", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondUnavailable()]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      accessibilityPage.visibleTextInMain(failureText),
    ).toBeVisible();
  });

  test("AC-4 a result and a completed copy are stated in visible text", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.recordClipboardWrites();
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      accessibilityPage.visibleTextInMain(
        new RegExp(displayedPostalCode(result.postalCode)),
      ),
    ).toBeVisible();

    await postalCodeGeneratorPage.copy();
    await expect(
      accessibilityPage.visibleTextInMain(copySuccessText),
    ).toBeVisible();
  });

  test("AC-5 a live region is listening before the first generation, then announces loading and the result without taking focus", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();

    // A region that arrives already holding its text is announced unreliably
    // across screen readers, so the region has to exist before the first
    // change it will carry.
    expect(await accessibilityPage.liveRegionCount()).toBeGreaterThan(0);
    expect(await accessibilityPage.announcementText()).not.toMatch(
      displayedPostalCode(result.postalCode),
    );

    postalCodeGeneratorPage.holdResponses();
    await accessibilityPage.operateWithKey(
      postalCodeGeneratorPage.generateAction(),
      "Enter",
    );
    await expect
      .poll(() => accessibilityPage.announcementText())
      .toMatch(loadingText);

    postalCodeGeneratorPage.releaseResponses();
    await expect
      .poll(() => accessibilityPage.announcementText())
      .toContain(displayedPostalCode(result.postalCode));

    // ui-design.md section 8: "do not move focus automatically to ordinary
    // success content". The visitor stays where they were, ready to generate
    // again.
    expect(
      await accessibilityPage.holdsFocus(
        postalCodeGeneratorPage.generateAction(),
      ),
    ).toBe(true);
  });

  test("AC-5 a failed generation is announced, and focus stays on the action that retries it", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondUnavailable()]);
    await postalCodeGeneratorPage.navigate();

    await accessibilityPage.operateWithKey(
      postalCodeGeneratorPage.generateAction(),
      "Enter",
    );

    await expect
      .poll(() => accessibilityPage.announcementText())
      .toMatch(failureText);

    // ui-design.md section 8 moves focus to an error summary only when
    // immediate action is required. A failed generation is retried by the
    // action the visitor just used, so leaving focus there is what keeps the
    // retry one key press away.
    expect(
      await accessibilityPage.holdsFocus(
        postalCodeGeneratorPage.generateAction(),
      ),
    ).toBe(true);
  });

  test("AC-5 a completed copy is announced", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.recordClipboardWrites();
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();
    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();

    await accessibilityPage.operateWithKey(
      postalCodeGeneratorPage.copyAction(),
      "Enter",
    );

    await expect
      .poll(() => accessibilityPage.announcementText())
      .toMatch(copySuccessText);
  });

  test("AC-5 arriving at another page from the keyboard is perceivable, and the document title names that page", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.navigate();

    await accessibilityPage.operateWithKey(
      postalCodeGeneratorPage.navigationLink(),
      "Enter",
    );
    await expect.poll(() => accessibilityPage.currentPath()).toBe("/privacy");
    await expect
      .poll(() => accessibilityPage.documentTitle())
      .toMatch(documentTitleSelectors.privacy);
    await expect
      .poll(() =>
        accessibilityPage.arrivalIsPerceivable(documentTitleSelectors.privacy),
      )
      .toBe(true);

    await accessibilityPage.operateWithKey(
      accessibilityPage.linkNamed(chromeSelectors.siteHeader),
      "Enter",
    );
    await expect.poll(() => accessibilityPage.currentPath()).toBe("/");
    await expect
      .poll(() => accessibilityPage.documentTitle())
      .not.toMatch(documentTitleSelectors.privacy);
    await expect
      .poll(() =>
        accessibilityPage.arrivalIsPerceivable(
          documentTitleSelectors.generator,
        ),
      )
      .toBe(true);
  });

  test("AC-6 each screen has one banner, one main, one contentinfo, and one top-level heading inside main", async ({
    accessibilityPage,
    advertisingPage,
    notFoundPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);

    const expectOneOfEachLandmark = async () => {
      await expect(accessibilityPage.banners()).toHaveCount(1);
      await expect(accessibilityPage.mains()).toHaveCount(1);
      await expect(accessibilityPage.contentInfos()).toHaveCount(1);
      await expect(accessibilityPage.topLevelHeadings()).toHaveCount(1);
      await expect(accessibilityPage.topLevelHeadingInsideMain()).toHaveCount(
        1,
      );
    };

    await postalCodeGeneratorPage.navigate();
    await expect(postalCodeGeneratorPage.generateAction()).toBeVisible();
    await expectOneOfEachLandmark();

    await postalCodeGeneratorPage.generate();
    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();
    await expectOneOfEachLandmark();

    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.heading()).toBeVisible();
    await expectOneOfEachLandmark();

    await notFoundPage.navigate();
    await expect(notFoundPage.heading()).toBeVisible();
    await expectOneOfEachLandmark();
  });

  test("AC-6 the result is a section titled by a second-level heading, and its addresses are a list", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      accessibilityPage.sectionHeadingNamed(resultHeadingName),
    ).toBeVisible();
    await expect(accessibilityPage.regionNamed(resultHeadingName)).toHaveCount(
      1,
    );

    for (const address of result.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toHaveCount(
        1,
      );
    }
  });

  test("AC-6 each screen's document title names that screen", async ({
    accessibilityPage,
    advertisingPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();

    await accessibilityPage.navigate("/");
    const generatorTitle = await accessibilityPage.documentTitle();
    expect(generatorTitle).toMatch(documentTitleSelectors.generator);

    await accessibilityPage.navigate("/privacy");
    const privacyTitle = await accessibilityPage.documentTitle();
    expect(privacyTitle).toMatch(documentTitleSelectors.privacy);

    await accessibilityPage.navigate(unknownPath);
    const notFoundTitle = await accessibilityPage.documentTitle();
    expect(notFoundTitle).toMatch(documentTitleSelectors.notFound);

    // A title that names every page at once names none of them.
    expect(new Set([generatorTitle, privacyTitle, notFoundTitle]).size).toBe(3);
  });

  test("AC-7 the advertisement area is one labelled region, with a label a sighted visitor can read and no application content inside it", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.substituteAdvertisingSdk();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();

    await expect(advertisingPage.advertisingRegion()).toHaveCount(1);

    // The accessible name is for assistive technology; a sighted visitor
    // needs the same word on screen.
    await expect(
      accessibilityPage.visibleTextInside(
        advertisingPage.advertisingRegion(),
        advertisingSelectors.regionLabel,
      ),
    ).toBeVisible();

    // Neither contains the other: the result is not inside the advertisement,
    // and the advertisement is not inside the result.
    await expect(
      advertisingPage
        .advertisingRegion()
        .filter({ hasText: displayedPostalCode(result.postalCode) }),
    ).toHaveCount(0);
    await expect(
      accessibilityPage.regionInside(
        accessibilityPage.regionNamed(resultHeadingName),
        advertisingSelectors.regionLabel,
      ),
    ).toHaveCount(0);
  });

  test("AC-8 the automated scan finds no WCAG A or AA violation on the idle generator", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await expect(postalCodeGeneratorPage.generateAction()).toBeVisible();

    expect(await accessibilityPage.scanForViolations()).toEqual([]);
  });

  test("AC-8 the automated scan finds no WCAG A or AA violation while a generation is loading", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();

    // Held open, so "loading" is a stable state for as long as the scan takes.
    postalCodeGeneratorPage.holdResponses();
    await postalCodeGeneratorPage.generate();
    await expect(postalCodeGeneratorPage.generateAction()).toBeDisabled();

    expect(await accessibilityPage.scanForViolations()).toEqual([]);

    postalCodeGeneratorPage.releaseResponses();
  });

  test("AC-8 the automated scan finds no WCAG A or AA violation on a result after it is copied", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.recordClipboardWrites();
    await advertisingPage.substituteAdvertisingSdk();
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(longAddressResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();
    await postalCodeGeneratorPage.copy();
    await expect(
      accessibilityPage.visibleTextInMain(copySuccessText),
    ).toBeVisible();

    expect(await accessibilityPage.scanForViolations()).toEqual([]);
  });

  test("AC-8 the automated scan finds no WCAG A or AA violation on a failed generation", async ({
    accessibilityPage,
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondUnavailable()]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();
    await expect(
      accessibilityPage.visibleTextInMain(failureText),
    ).toBeVisible();

    expect(await accessibilityPage.scanForViolations()).toEqual([]);
  });

  test("AC-8 the automated scan finds no WCAG A or AA violation on the privacy page", async ({
    accessibilityPage,
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.contactLink()).toBeVisible();

    expect(await accessibilityPage.scanForViolations()).toEqual([]);
  });

  test("AC-8 the automated scan finds no WCAG A or AA violation on the not-found screen", async ({
    accessibilityPage,
    notFoundPage,
  }) => {
    await notFoundPage.navigate();
    await expect(notFoundPage.backToGeneratorLink()).toBeVisible();

    expect(await accessibilityPage.scanForViolations()).toEqual([]);
  });
});
