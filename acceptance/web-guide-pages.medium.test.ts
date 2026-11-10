import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  createAccessibilityPage,
  type AccessibilityPage,
} from "./pages/accessibility-page.ts";
import {
  createAdEligibilityPage,
  type AdActivity,
  type AdEligibilityPage,
} from "./pages/ad-eligibility-page.ts";
import {
  createAdvertisingPage,
  type AdvertisingPage,
} from "./pages/advertising-page.ts";
import { createGuidePage, type GuidePage } from "./pages/guide-page.ts";
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
import { representativeViewports } from "./selectors/accessibility-selectors.ts";
import {
  capabilityWords,
  dataPageFacts,
  type Guide,
  guideSelectors,
  guides,
  japanPostOrigin,
} from "./selectors/guide-selectors.ts";

/*
 * Acceptance test for Issue #121: Add original guide pages and make them
 * discoverable.
 *
 * Each test name starts with the acceptance criteria it holds, numbered in
 * the Issue's order:
 *
 *   AC-3  References are visible: every guide has a 参考にした資料 section
 *         linking to Japan Post, and the data page shows its retrieval date
 *         and postal-code count.
 *   AC-4  `/` before any generation shows Zipnamiでできること with the three
 *         capabilities and 郵便番号をもっと知る with at least three guide
 *         links, each opening its page.
 *   AC-5  At 1440, 768, 390 and 320px no guide page and not the idle
 *         generator scrolls sideways; every guide page passes the WCAG A and
 *         AA scan; every footer guide link is in the tab order.
 *   AC-6  The result and error states keep the same guide links as every
 *         other screen, and no guide link leads to the not-found screen.
 *   AC-7  Each guide is a client-rendered route that, by direct navigation
 *         and by refresh, shows its h1 and body without Generate or an API
 *         request, and sets `<name> | Zipnami` and its own description.
 *   AC-8  The footer of every screen carries the ガイド navigation, and no
 *         guide page carries a means of contact.
 *   AC-9  No guide page and not the idle generator requests an ad.
 *
 * The page names, section names, and order are ui-design.md section 5.5's
 * contract, held in selectors/guide-selectors.ts. No Figma node exists for
 * these screens yet (section 9.1), so no Figma copy is held here.
 *
 * Not held here:
 *
 * - AC-1 (the contract update) and AC-11 (screenshots attached to the PR, the
 *   production review, the AdSense request) are documents and process,
 *   settled by review of the change.
 * - AC-2 and the accuracy half of AC-3: whether the copy is original,
 *   valuable, and true to its sources is a reader's judgement, settled by
 *   review against Japan Post's pages and packages/postal-data/README.md.
 *   What a browser can see — that the sources are linked and the data facts
 *   are stated — is held.
 * - The visual half of AC-5 (prominent CTA, no overlapping cards, contrast
 *   beyond what axe measures) is appearance, which ADR-0012 keeps out of
 *   automated tests; it is the PR's screenshots and VRT.
 * - AC-10 is held by the existing acceptance tests passing, two of them
 *   rewritten with the owner's approval for the new links:
 *   https://github.com/kishimin/random-postal-code/issues/121#issuecomment-6765803728
 * - Cloudflare Pages itself: vite preview answers a deep link with the same
 *   SPA fallback, and the deployment's own fallback is Issue #5's test.
 * - The global error screen: a browser cannot be driven to the render failure
 *   that shows it (ui-design.md section 10).
 *
 * Nothing here contacts Google. Advertising and consent requests are refused,
 * except in the AC-9 tests, which answer the AdSense loader with the Issue #9
 * substitute so a misplaced ad would really show. `GET /api/random` is
 * stubbed, as in the Issue #6 acceptance test, and its requests counted.
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

const result = datasetEntry("3670030");

const guideNames = guides.map((guide) => guide.name);

/**
 * Finds a guide by its route.
 * @param path - The guide's route.
 */
const guideAt = (path: string): Guide => {
  const guide = guides.find((candidate) => candidate.path === path);

  if (!guide) {
    throw new Error(`No guide is listed at ${path}.`);
  }

  return guide;
};

// The widths AC-5 names: desktop, tablet, phone, and the narrowest phone.
const criterionWidths = [1440, 768, 390, 320];
const criterionViewports = representativeViewports.filter((viewport) =>
  criterionWidths.includes(viewport.width),
);

// A body section has to say something beyond its heading. A sentence of
// Japanese runs well past this; an empty or one-word section does not.
const minimumBodyText = 40;

// How long a screen is watched for a late ad request, as in the Issue #120
// acceptance test. Generous rather than tuned: what is held is an absence.
const settleWindow = 2000;

const nothingRequested: AdActivity = { loaderRequests: 0, pushes: 0 };

/*
 * Extends the shell fixture rather than editing it (committed files under
 * acceptance/ are locked).
 *
 * The ad observer records pushes and answers the loader before anything
 * else, so a request from the very first screen is already counted. It is
 * only set up by the tests that ask for it.
 */
const test = shellTest.extend<{
  accessibilityPage: AccessibilityPage;
  adEligibilityPage: AdEligibilityPage;
  advertisingPage: AdvertisingPage;
  guidePage: GuidePage;
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
  privacyDisclosurePage: PrivacyDisclosurePage;
}>({
  accessibilityPage: async ({ page }, use) => {
    await use(createAccessibilityPage(page));
  },
  adEligibilityPage: async ({ page }, use) => {
    const adEligibilityPage = createAdEligibilityPage(page);
    await adEligibilityPage.recordAdPushes();
    await adEligibilityPage.answerAdRequestsWithFilledAds();
    await use(adEligibilityPage);
  },
  advertisingPage: async ({ page }, use) => {
    await use(createAdvertisingPage(page));
  },
  guidePage: async ({ page }, use) => {
    await use(createGuidePage(page));
  },
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
  privacyDisclosurePage: async ({ page }, use) => {
    await use(createPrivacyDisclosurePage(page));
  },
});

/**
 * Holds that a guide page shows its own content: one h1 with its name, at
 * least two body sections each a region named by its h2 and carrying text,
 * and a 参考にした資料 section linking to Japan Post.
 * @param guidePage - The guide pages' Page Object.
 * @param guide - The guide the browser is on.
 */
const expectGuideContent = async (guidePage: GuidePage, guide: Guide) => {
  await expect(guidePage.heading(guide.name)).toBeVisible();
  await expect(guidePage.topLevelHeadings()).toHaveCount(1);
  await expect(guidePage.notFoundHeading()).toHaveCount(0);

  const bodySections = (await guidePage.sectionHeadingNames()).filter(
    (name) => name !== guideSelectors.sourcesHeading,
  );
  expect(
    bodySections.length,
    `body sections of ${guide.name}: ${JSON.stringify(bodySections)}`,
  ).toBeGreaterThanOrEqual(2);
  for (const name of bodySections) {
    await expect(guidePage.headingOfRegion(name), name).toBeVisible();
    expect(
      await guidePage.bodyTextLength(name),
      `body text under ${name}`,
    ).toBeGreaterThanOrEqual(minimumBodyText);
  }

  await expect(
    guidePage.headingOfRegion(guideSelectors.sourcesHeading),
  ).toBeVisible();
  const sources = await guidePage.sourceLinkTargets();
  expect(
    sources.some((target) => target.startsWith(japanPostOrigin)),
    `sources of ${guide.name}: ${JSON.stringify(sources)}`,
  ).toBe(true);
};

/**
 * Holds that the footer's ガイド navigation lists exactly the five guides, in
 * the contract's order, and marks only the given one as the current page.
 * @param guidePage - The guide pages' Page Object.
 * @param current - The guide the browser is on, or none off a guide page.
 */
const expectFooterGuideNavigation = async (
  guidePage: GuidePage,
  current?: Guide,
) => {
  await expect(guidePage.footerGuideNavigation()).toHaveCount(1);
  await expect(guidePage.footerGuideLinks()).toHaveText([...guideNames]);

  for (const guide of guides) {
    const link = guidePage.footerGuideLink(guide.name);
    if (guide === current) {
      await expect(link, guide.name).toHaveAttribute("aria-current", "page");
    } else {
      await expect(link, guide.name).not.toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  }
};

/**
 * Holds that the current screen requested no ad and shows none, on arrival
 * and again after a late request has had time to arrive.
 * @param adEligibilityPage - The ad observer.
 */
const expectNoAdRequested = async (adEligibilityPage: AdEligibilityPage) => {
  await expect(adEligibilityPage.adUnits()).toHaveCount(0);

  await adEligibilityPage.letLateAdRequestsArrive(settleWindow);

  expect(await adEligibilityPage.adActivity()).toEqual(nothingRequested);
  await expect(adEligibilityPage.adUnits()).toHaveCount(0);
};

test.describe("Issue #121: original guide pages, the footer's guide links, and the generator's overview", () => {
  test.beforeEach(async ({ advertisingPage }) => {
    await advertisingPage.failEveryAdvertisingRequest();
  });

  for (const guide of guides) {
    test(`AC-3 AC-7 ${guide.path}: direct navigation and a refresh show its h1, body sections, and sources, and its title, with no generation and no API request`, async ({
      guidePage,
      postalCodeGeneratorPage,
    }) => {
      await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);

      await guidePage.navigate(guide.path);
      await expectGuideContent(guidePage, guide);
      await expect
        .poll(() => guidePage.documentTitle())
        .toBe(`${guide.name}${guideSelectors.titleSuffix}`);
      await expect.poll(() => guidePage.metaDescription()).not.toBe("");

      await guidePage.reload();
      expect(guidePage.currentPath()).toBe(guide.path);
      await expectGuideContent(guidePage, guide);
      await expect
        .poll(() => guidePage.documentTitle())
        .toBe(`${guide.name}${guideSelectors.titleSuffix}`);

      // The content arrived without the generator's endpoint being asked.
      expect(postalCodeGeneratorPage.randomRequestCount()).toBe(0);
    });

    test(`AC-8 ${guide.path}: the footer's ガイド navigation lists the five guides in order with this one current, and the page offers no means of contact`, async ({
      guidePage,
    }) => {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      await expectFooterGuideNavigation(guidePage, guide);

      await expect(guidePage.contactLinks()).toHaveCount(0);
      await expect(guidePage.forms()).toHaveCount(0);
      await expect(
        guidePage.pageStating(guideSelectors.contactWord),
      ).toHaveCount(0);
    });

    test(`AC-5 ${guide.path}: no horizontal scrolling at 1440, 768, 390 and 320px, and the automated scan finds no WCAG A or AA violation`, async ({
      accessibilityPage,
      guidePage,
    }) => {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      expect(await accessibilityPage.scanForViolations()).toEqual([]);

      for (const viewport of criterionViewports) {
        await accessibilityPage.resizeTo(viewport);
        await expect(guidePage.heading(guide.name)).toBeVisible();
        expect(
          await accessibilityPage.hasHorizontalOverflow(),
          viewport.name,
        ).toBe(false);
      }
    });
  }

  test("AC-3 /guide/data states the retrieval date and the number of postal codes in Zipnami's dataset", async ({
    guidePage,
  }) => {
    const dataGuide = guideAt("/guide/data");
    await guidePage.navigate(dataGuide.path);
    await expect(guidePage.heading(dataGuide.name)).toBeVisible();

    await expect(
      guidePage.mainStating(dataPageFacts.retrievalDate),
    ).toBeVisible();
    await expect(
      guidePage.mainStating(dataPageFacts.postalCodeCount),
    ).toBeVisible();
  });

  test("AC-7 each guide page sets its own meta description, different from the other four", async ({
    guidePage,
  }) => {
    const descriptions: string[] = [];

    for (const guide of guides) {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();
      await expect.poll(() => guidePage.metaDescription()).not.toBe("");
      descriptions.push(await guidePage.metaDescription());
    }

    // One description shared by every page describes none of them.
    expect(new Set(descriptions).size, JSON.stringify(descriptions)).toBe(
      guides.length,
    );
  });

  test("AC-4 before any generation, / shows Zipnamiでできること with the three capabilities and 郵便番号をもっと知る with at least three guide links, each opening its page", async ({
    guidePage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await expect(postalCodeGeneratorPage.startAction()).toBeVisible();

    await expect(
      guidePage.headingOfRegion(guideSelectors.capabilitiesHeading),
    ).toBeVisible();
    for (const word of capabilityWords) {
      await expect(
        guidePage.capabilitiesRegion().filter({ hasText: word }),
        String(word),
      ).toHaveCount(1);
    }

    await expect(
      guidePage.headingOfRegion(guideSelectors.learnMoreHeading),
    ).toBeVisible();
    const linkCount = await guidePage.learnMoreLinks().count();
    expect(linkCount).toBeGreaterThanOrEqual(3);

    // Each link is named by its guide's own name (ui-design.md section 5.5),
    // so the page it opens has to carry that name as its h1.
    for (let index = 0; index < linkCount; index += 1) {
      await postalCodeGeneratorPage.navigate();
      const name = await guidePage.learnMoreLinkName(index);
      expect(guideNames, name).toContain(name);

      await guidePage.follow(guidePage.learnMoreLinks().nth(index));

      await expect(guidePage.heading(name)).toBeVisible();
      await expect(guidePage.notFoundHeading()).toHaveCount(0);
    }

    expect(postalCodeGeneratorPage.randomRequestCount()).toBe(0);
  });

  test("AC-4 AC-6 the overview stays while a first generation fails with no result, and both sections are gone once a result is shown", async ({
    guidePage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondUnavailable(),
      respondWith(result),
    ]);
    await postalCodeGeneratorPage.navigate();

    await postalCodeGeneratorPage.generate();
    await expect(postalCodeGeneratorPage.retryAction()).toBeVisible();
    await expect(guidePage.capabilitiesRegion()).toBeVisible();
    await expect(guidePage.learnMoreRegion()).toBeVisible();

    await postalCodeGeneratorPage.generate();
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();
    await expect(guidePage.capabilitiesRegion()).toHaveCount(0);
    await expect(guidePage.learnMoreRegion()).toHaveCount(0);
  });

  test("AC-6 AC-8 the footer's ガイド navigation lists the five guides in order on the idle generator, a failure with no result, a result, /privacy, and the not-found screen", async ({
    guidePage,
    notFoundPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondUnavailable(),
      respondWith(result),
    ]);

    await postalCodeGeneratorPage.navigate();
    await expect(postalCodeGeneratorPage.startAction()).toBeVisible();
    await expectFooterGuideNavigation(guidePage);

    await postalCodeGeneratorPage.generate();
    await expect(postalCodeGeneratorPage.retryAction()).toBeVisible();
    await expect(postalCodeGeneratorPage.anyPostalCodeDisplay()).toHaveCount(0);
    await expectFooterGuideNavigation(guidePage);

    await postalCodeGeneratorPage.generate();
    await expect(postalCodeGeneratorPage.regenerateAction()).toBeVisible();
    await expectFooterGuideNavigation(guidePage);

    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.heading()).toBeVisible();
    await expectFooterGuideNavigation(guidePage);

    await notFoundPage.navigate();
    await expect(notFoundPage.heading()).toBeVisible();
    await expectFooterGuideNavigation(guidePage);
  });

  test("AC-5 AC-6 every footer guide link is in the tab order and, followed from the keyboard on a result screen, opens its page rather than the not-found screen", async ({
    accessibilityPage,
    guidePage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);

    for (const guide of guides) {
      await postalCodeGeneratorPage.navigate();
      await postalCodeGeneratorPage.generate();
      await expect(postalCodeGeneratorPage.regenerateAction()).toBeVisible();

      // Tab reachability is held as tab order rather than by pressing Tab:
      // WebKit skips links unless full keyboard access is switched on, the
      // same finding the Issue #16 acceptance test records.
      const link = guidePage.footerGuideLink(guide.name);
      expect(
        await accessibilityPage.tabIndexOf(link),
        guide.name,
      ).toBeGreaterThanOrEqual(0);
      expect(await accessibilityPage.elementsAheadOfDocumentOrder()).toBe(0);

      await accessibilityPage.operateWithKey(link, "Enter");

      await expect.poll(() => guidePage.currentPath()).toBe(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();
      await expect(guidePage.notFoundHeading()).toHaveCount(0);
    }
  });

  test("AC-5 before any generation, / has no horizontal scrolling at 1440, 768, 390 and 320px with the overview shown", async ({
    accessibilityPage,
    guidePage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await expect(postalCodeGeneratorPage.startAction()).toBeVisible();

    for (const viewport of criterionViewports) {
      await accessibilityPage.resizeTo(viewport);
      await expect(guidePage.learnMoreRegion(), viewport.name).toBeVisible();
      expect(
        await accessibilityPage.hasHorizontalOverflow(),
        viewport.name,
      ).toBe(false);
    }
  });
});

test.describe("Issue #121: the guide pages and the overview request no ad", () => {
  for (const guide of guides) {
    test(`AC-9 ${guide.path} requests no ad: no loader request, no ad unit, no push`, async ({
      adEligibilityPage,
      guidePage,
    }) => {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      await expectNoAdRequested(adEligibilityPage);
    });
  }

  test("AC-9 / before any generation, with the overview shown, requests no ad", async ({
    adEligibilityPage,
    guidePage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await expect(postalCodeGeneratorPage.startAction()).toBeVisible();
    await expect(guidePage.learnMoreRegion()).toBeVisible();

    await expectNoAdRequested(adEligibilityPage);
  });
});
