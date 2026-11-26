import { readFileSync } from "node:fs";
import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
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
import {
  createCrawlablePage,
  type CrawlablePage,
} from "./pages/crawlable-page.ts";
import {
  createGuideArticlePage,
  type GuideArticlePage,
} from "./pages/guide-article-page.ts";
import { createGuidePage, type GuidePage } from "./pages/guide-page.ts";
import { representativeViewports } from "./selectors/accessibility-selectors.ts";
import {
  categorizedGuides,
  guideCategories,
  guideIndex,
  minimumBodyCharacters,
  newGuides,
  officialSourceOrigins,
} from "./selectors/guide-article-selectors.ts";
import { guides, guideSelectors } from "./selectors/guide-selectors.ts";

/*
 * Acceptance test for Issue #170: Expand the guides into substantial,
 * sourced original articles for the AdSense review.
 *
 * Each test name starts with the acceptance criteria it holds, numbered in
 * the Issue's order:
 *
 *   AC-2  Each of the five existing pages has at least 2,000 characters of
 *         body text.
 *   AC-3  At least five new /guide/* pages exist, each with at least 2,000
 *         characters of body text, and no two pages repeat a paragraph.
 *   AC-4  Every guide names its sources on the page, and they are official.
 *   AC-5  Every example postal code is a code of the dataset Zipnami ships.
 *   AC-6  Every guide is reachable within two clicks of the top page, from
 *         the footer navigation and a guide index.
 *   AC-7  Each guide links to at least two related guides, and no link in a
 *         guide or the index leads to a 404.
 *   AC-8  The new pages meet the layout and accessibility rules at 1440,
 *         768, 390 and 320px, and work from the keyboard.
 *   AC-10 The guide pages show no ads.
 *
 * Decisions this test holds, recorded by the loop for Issue #170
 * --------------------------------------------------------------
 * - The names, routes, categories and the footer's すべてのガイド landmark
 *   are ui-design.md section 5.5 ("Guide index and categories"), held in
 *   selectors/guide-article-selectors.ts. The five guides of Issue #121 keep
 *   their footer navigation, which web-guide-pages.medium.test.ts holds.
 * - "2,000 Japanese characters of body text, not counting navigation,
 *   headings or source lists" is counted in the browser as the text of each
 *   body region without its heading and without whitespace. The related
 *   guides and the sources are not body. The lead above the first region is
 *   left out too, so the count can only understate the body.
 * - "No two pages repeat the same paragraphs" is held on every paragraph a
 *   reader sees in main, across the ten guides.
 * - "Example postal codes come from the dataset Zipnami ships" is held on
 *   every code a guide writes in the NNN-NNNN form: each must be a code of
 *   apps/web/backend/src/data/postal-codes.generated.json, the dataset the
 *   API serves, built from the retrieval /guide/data names.
 * - "Official sources" is held as: every link in 参考にした資料 leads to
 *   Japan Post's or 総務省's site. Whether each claim matches its source is
 *   a reader's judgement, settled by review against those pages.
 * - "Within two clicks from the top page" is held from the idle generator:
 *   the footer's ガイド一覧, then the guide's link on the index.
 * - Keyboard operation is held as tab order and Enter, not by pressing Tab:
 *   WebKit skips links unless full keyboard access is switched on, as the
 *   Issue #16 and #121 acceptance tests record.
 *
 * Not held here:
 *
 * - AC-1 (the contract update before the implementation) is an order of
 *   work, settled by the contract commit preceding this test.
 * - AC-9: sitemap.xml and prerendering of the new routes are held by the
 *   Issue #169 test, whose route list now includes them, with the owner's
 *   approval:
 *   https://github.com/kishimin/random-postal-code/issues/170#issuecomment-7176123461
 * - AC-11 is held by the existing acceptance tests passing.
 * - The visual half of AC-8 is appearance, which ADR-0012 keeps out of
 *   automated tests.
 *
 * Nothing here contacts Google: advertising requests are refused, except in
 * the AC-10 tests, which answer the AdSense loader with the Issue #9
 * substitute so a misplaced ad would really show.
 */

/*
 * The postal codes of the dataset the API serves. Read once, as a set: the
 * file is about 13 MB, and a lookup is all this test needs.
 */
const shippedPostalCodes: ReadonlySet<string> = new Set(
  (
    JSON.parse(
      readFileSync(
        new URL(
          "../apps/web/backend/src/data/postal-codes.generated.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as PostalCode[]
  ).map(({ postalCode }) => postalCode),
);

// A seven-digit code as the guides write it, and not part of a longer number.
const writtenPostalCode = /(?<![\d-])\d{3}-\d{4}(?![\d-])/g;

// The widths AC-8 names: desktop, tablet, phone, and the narrowest phone.
const criterionWidths = [1440, 768, 390, 320];
const criterionViewports = representativeViewports.filter((viewport) =>
  criterionWidths.includes(viewport.width),
);

// How long a screen is watched for a late ad request, as in the Issue #121
// acceptance test. Generous rather than tuned: what is held is an absence.
const settleWindow = 2000;

const nothingRequested: AdActivity = { loaderRequests: 0, pushes: 0 };

const test = shellTest.extend<{
  accessibilityPage: AccessibilityPage;
  adEligibilityPage: AdEligibilityPage;
  advertisingPage: AdvertisingPage;
  crawlablePage: CrawlablePage;
  guideArticlePage: GuideArticlePage;
  guidePage: GuidePage;
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
  crawlablePage: async ({ page, request }, use) => {
    await use(createCrawlablePage(page, request));
  },
  guideArticlePage: async ({ page }, use) => {
    await use(createGuideArticlePage(page));
  },
  guidePage: async ({ page }, use) => {
    await use(createGuidePage(page));
  },
});

// The five existing guides are guide-selectors.ts's; the new five are this
// Issue's. Together they are the ten the guide index lists.
const existingPaths = new Set(guides.map(({ path }) => path));

test.describe("Issue #170: each guide is a substantial, sourced article", () => {
  test.beforeEach(async ({ advertisingPage }) => {
    await advertisingPage.failEveryAdvertisingRequest();
  });

  for (const guide of categorizedGuides) {
    const criterion = existingPaths.has(guide.path) ? "AC-2" : "AC-3";

    test(`${criterion} ${guide.path}: at least ${minimumBodyCharacters} characters of body text`, async ({
      guideArticlePage,
      guidePage,
    }) => {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      expect(
        await guideArticlePage.bodyCharacterCount(),
      ).toBeGreaterThanOrEqual(minimumBodyCharacters);
    });

    test(`AC-4 ${guide.path}: names its sources in 参考にした資料, each on an official site`, async ({
      guidePage,
    }) => {
      await guidePage.navigate(guide.path);
      await expect(
        guidePage.headingOfRegion(guideSelectors.sourcesHeading),
      ).toBeVisible();

      const sources = await guidePage.sourceLinkTargets();
      expect(sources.length, guide.path).toBeGreaterThan(0);
      expect(
        sources.filter(
          (target) =>
            !officialSourceOrigins.some((origin) => target.startsWith(origin)),
        ),
      ).toEqual([]);
    });

    test(`AC-5 ${guide.path}: every postal code it writes is a code of the shipped dataset`, async ({
      guideArticlePage,
      guidePage,
    }) => {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      const written = (await guideArticlePage.mainText()).match(
        writtenPostalCode,
      );
      expect(
        (written ?? []).filter(
          (code) => !shippedPostalCodes.has(code.replace("-", "")),
        ),
      ).toEqual([]);
    });

    test(`AC-7 ${guide.path}: links to at least two other guides under 関連するガイド, and none of its links answers 404`, async ({
      crawlablePage,
      guideArticlePage,
      guidePage,
    }) => {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      const otherGuideNames = categorizedGuides
        .filter(({ path }) => path !== guide.path)
        .map(({ name }) => name);
      const related = (
        await guideArticlePage.relatedGuideLinks().allInnerTexts()
      ).map((name) => name.trim());
      expect(
        related.filter((name) => otherGuideNames.includes(name)).length,
        JSON.stringify(related),
      ).toBeGreaterThanOrEqual(2);

      const answers: string[] = [];
      for (const path of new Set(await guideArticlePage.ownLinkPaths())) {
        const { status } = await crawlablePage.fetchRaw(path);
        if (status !== 200) answers.push(`${path} ${status}`);
      }
      expect(answers).toEqual([]);
    });
  }

  test("AC-3 at least five new /guide/* pages exist beyond the five of Issue #121, each with its own h1", async ({
    guidePage,
  }) => {
    const added = newGuides.filter(
      ({ path }) => path.startsWith("/guide/") && !existingPaths.has(path),
    );
    expect(added.length).toBeGreaterThanOrEqual(5);

    for (const guide of added) {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name), guide.path).toBeVisible();
      await expect(guidePage.notFoundHeading()).toHaveCount(0);
    }
  });

  test("AC-3 no paragraph appears on two guides", async ({
    guideArticlePage,
    guidePage,
  }) => {
    const pagesOf = new Map<string, string[]>();

    for (const guide of categorizedGuides) {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      for (const paragraph of new Set(
        await guideArticlePage.paragraphTexts(),
      )) {
        if (paragraph === "") continue;
        pagesOf.set(paragraph, [...(pagesOf.get(paragraph) ?? []), guide.path]);
      }
    }

    const repeated = [...pagesOf].filter(([, paths]) => paths.length > 1);
    expect(repeated).toEqual([]);
  });
});

test.describe("Issue #170: every guide is two clicks from the top page", () => {
  test.beforeEach(async ({ advertisingPage }) => {
    await advertisingPage.failEveryAdvertisingRequest();
  });

  test("AC-6 the guide index lists the ten guides under their three categories, in order", async ({
    guideArticlePage,
    guidePage,
  }) => {
    await guidePage.navigate(guideIndex.path);
    await expect(guidePage.heading(guideIndex.name)).toBeVisible();
    await expect(guidePage.topLevelHeadings()).toHaveCount(1);

    for (const category of guideCategories) {
      await expect(guidePage.headingOfRegion(category), category).toBeVisible();
      expect(await guideArticlePage.categoryLinkNames(category)).toEqual(
        categorizedGuides
          .filter((guide) => guide.category === category)
          .map(({ name }) => name),
      );
    }
  });

  for (const guide of categorizedGuides) {
    test(`AC-6 ${guide.path}: from the top page, the footer's ガイド一覧 and then the index's link open it`, async ({
      crawlablePage,
      guideArticlePage,
      guidePage,
    }) => {
      await guidePage.navigate("/");
      await guidePage.follow(guideArticlePage.footerIndexLink());
      await expect.poll(() => guidePage.currentPath()).toBe(guideIndex.path);
      await expect(guidePage.heading(guideIndex.name)).toBeVisible();

      await guidePage.follow(guideArticlePage.mainLink(guide.name));
      await expect.poll(() => guidePage.currentPath()).toBe(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();
      await expect(guidePage.notFoundHeading()).toHaveCount(0);

      expect(crawlablePage.consoleProblemsSoFar()).toEqual([]);
    });
  }

  test("AC-6 the footer of a guide, the generator and the not-found screen carries すべてのガイド with ガイド一覧, current only on the index", async ({
    guideArticlePage,
    guidePage,
  }) => {
    for (const path of ["/", newGuides[0].path, "/nonexistent"]) {
      await guidePage.navigate(path);
      await expect(guideArticlePage.footerIndexNavigation(), path).toHaveCount(
        1,
      );
      await expect(guideArticlePage.footerIndexLink(), path).toBeVisible();
      await expect(guideArticlePage.footerIndexLink()).not.toHaveAttribute(
        "aria-current",
        "page",
      );
    }

    await guidePage.navigate(guideIndex.path);
    await expect(guideArticlePage.footerIndexLink()).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("AC-7 none of the guide index's links answers 404", async ({
    crawlablePage,
    guideArticlePage,
    guidePage,
  }) => {
    await guidePage.navigate(guideIndex.path);
    await expect(guidePage.heading(guideIndex.name)).toBeVisible();

    const answers: string[] = [];
    for (const path of new Set(await guideArticlePage.ownLinkPaths())) {
      const { status } = await crawlablePage.fetchRaw(path);
      if (status !== 200) answers.push(`${path} ${status}`);
    }
    expect(answers).toEqual([]);
  });
});

test.describe("Issue #170: the new pages meet the layout and accessibility rules", () => {
  test.beforeEach(async ({ advertisingPage }) => {
    await advertisingPage.failEveryAdvertisingRequest();
  });

  for (const guide of [guideIndex, ...newGuides]) {
    test(`AC-8 ${guide.path}: no horizontal scrolling at 1440, 768, 390 and 320px, and the automated scan finds no WCAG A or AA violation`, async ({
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

  test("AC-8 every guide link on the index is in the tab order and opens its guide with Enter", async ({
    accessibilityPage,
    guideArticlePage,
    guidePage,
  }) => {
    for (const guide of categorizedGuides) {
      await guidePage.navigate(guideIndex.path);
      await expect(guidePage.heading(guideIndex.name)).toBeVisible();

      const link = guideArticlePage.mainLink(guide.name);
      expect(
        await accessibilityPage.tabIndexOf(link),
        guide.name,
      ).toBeGreaterThanOrEqual(0);
      expect(await accessibilityPage.elementsAheadOfDocumentOrder()).toBe(0);

      await accessibilityPage.operateWithKey(link, "Enter");
      await expect.poll(() => guidePage.currentPath()).toBe(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();
    }
  });

  test("AC-8 a new guide's related-guide links are in the tab order and open their guide with Enter", async ({
    accessibilityPage,
    guideArticlePage,
    guidePage,
  }) => {
    for (const guide of newGuides) {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      const link = guideArticlePage.relatedGuideLinks().first();
      const name = (await link.innerText()).trim();
      const target = categorizedGuides.find(
        (candidate) => candidate.name === name,
      );
      expect(target, `${guide.path} → ${name}`).toBeDefined();

      expect(await accessibilityPage.tabIndexOf(link)).toBeGreaterThanOrEqual(
        0,
      );
      await accessibilityPage.operateWithKey(link, "Enter");
      await expect.poll(() => guidePage.currentPath()).toBe(target?.path);
      await expect(guidePage.heading(name)).toBeVisible();
    }
  });
});

test.describe("Issue #170: the guide pages request no ad", () => {
  for (const guide of [guideIndex, ...newGuides]) {
    test(`AC-10 ${guide.path} requests no ad: no loader request, no ad unit, no push`, async ({
      adEligibilityPage,
      guidePage,
    }) => {
      await guidePage.navigate(guide.path);
      await expect(guidePage.heading(guide.name)).toBeVisible();

      await expect(adEligibilityPage.adUnits()).toHaveCount(0);
      await adEligibilityPage.letLateAdRequestsArrive(settleWindow);
      expect(await adEligibilityPage.adActivity()).toEqual(nothingRequested);
      await expect(adEligibilityPage.adUnits()).toHaveCount(0);
    });
  }
});
