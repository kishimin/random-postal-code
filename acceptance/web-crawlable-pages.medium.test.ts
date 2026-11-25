import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  createAdvertisingPage,
  type AdvertisingPage,
} from "./pages/advertising-page.ts";
import {
  createCrawlablePage,
  type CrawlablePage,
  type RawResponse,
} from "./pages/crawlable-page.ts";
import { createGuidePage, type GuidePage } from "./pages/guide-page.ts";
import {
  createHeaderLogoPage,
  type HeaderLogoPage,
} from "./pages/header-logo-page.ts";
import {
  createPostalCodeGeneratorPage,
  respondWith,
  type PostalCodeGeneratorPage,
} from "./pages/postal-code-generator-page.ts";
import {
  createPrivacyDisclosurePage,
  type PrivacyDisclosurePage,
} from "./pages/privacy-disclosure-page.ts";
import {
  adSenseLoaderReference,
  type ContentRoute,
  contentRoutes,
  productionUrlOf,
  sitemapUrl,
  unknownContentPath,
} from "./selectors/crawlable-page-selectors.ts";
import { guideSelectors, guides } from "./selectors/guide-selectors.ts";

/*
 * Acceptance test for Issue #169: Serve each content page as its own
 * crawlable HTML, with robots.txt, a sitemap and real 404s (browser half).
 *
 * Each test name starts with the acceptance criteria it holds, numbered in
 * the Issue's order:
 *
 *   AC-2  Each of the seven content routes, fetched without running
 *         JavaScript, carries its own h1, body text, <title>, meta
 *         description and canonical URL, and no two responses are identical.
 *   AC-3  Once the client loads, each page behaves as before: direct
 *         navigation, refresh, in-app navigation and generation, with no
 *         console error (a hydration error included).
 *   AC-4  /robots.txt answers 200 as text/plain, allows every crawler and
 *         names the sitemap.
 *   AC-5  /sitemap.xml answers 200 as XML and lists exactly the seven routes
 *         as absolute production URLs.
 *   AC-6  An unknown path answers HTTP 404 and shows the not-found screen.
 *   AC-8  No content route's HTML loads the AdSense loader.
 *
 * The build half — the google-adsense-account tag (AC-7), the loader in a
 * build with a real publisher ID (AC-8), and what Pages is told about unknown
 * paths — is web-crawlable-pages-build.medium.test.ts.
 *
 * Decisions this test holds, recorded by the loop for Issue #169
 * --------------------------------------------------------------
 * - The server is `vite preview` of the production build
 *   (playwright.config.ts). It has to answer the way Cloudflare Pages
 *   answers the same build: each route with its own HTML, an unmatched path
 *   with the not-found page and status 404. What Pages is told to do with
 *   unknown paths (no SPA catch-all) is the build half's to hold.
 * - "Without running JavaScript" is held two ways: the bytes the server
 *   answers, fetched with no browser, and the same document opened in a
 *   browser context with JavaScript disabled, so the page is read by role and
 *   accessible name (ADR-0012) as a reader without scripts meets it.
 * - The canonical URL and the sitemap entries are on the fixed production
 *   origin https://zipnami.pages.dev (docs/design.md section 6.2), the root
 *   written with its slash.
 * - "That page's own meta description" is held as: one non-empty
 *   description per page, and no two of the seven alike. The wording is the
 *   page's own and free to change.
 * - The client may replace the prerendered markup rather than hydrate it.
 *   Either way the console must stay free of errors on load, refresh and
 *   in-app navigation.
 *
 * Not held here:
 *
 * - AC-1 (the contract update before the implementation) is an order of
 *   work, settled by commit a0944d1 preceding this test.
 * - AC-9 is held by the existing acceptance tests passing unchanged against
 *   the prerendered build; the history and the result screen's ad behaviour
 *   after load are theirs (web-generation-history, web-ad-eligibility).
 * - AC-10 (a curl of production after the deploy) is done by hand.
 *
 * Nothing here contacts Google: every advertising request is refused, and
 * `GET /api/random` is stubbed as in the Issue #6 acceptance test.
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

// A body section has to say something beyond its heading, as in the Issue
// #121 acceptance test. A privacy section states at least a sentence.
const minimumGuideSectionText = 40;
const minimumPrivacySectionText = 20;

const test = shellTest.extend<{
  advertisingPage: AdvertisingPage;
  crawlablePage: CrawlablePage;
  guidePage: GuidePage;
  headerLogoPage: HeaderLogoPage;
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
  privacyDisclosurePage: PrivacyDisclosurePage;
}>({
  advertisingPage: async ({ page }, use) => {
    await use(createAdvertisingPage(page));
  },
  crawlablePage: async ({ page, request }, use) => {
    await use(createCrawlablePage(page, request));
  },
  guidePage: async ({ page }, use) => {
    await use(createGuidePage(page));
  },
  headerLogoPage: async ({ page }, use) => {
    await use(createHeaderLogoPage(page));
  },
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
  privacyDisclosurePage: async ({ page }, use) => {
    await use(createPrivacyDisclosurePage(page));
  },
});

type Screens = {
  guidePage: GuidePage;
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
  privacyDisclosurePage: PrivacyDisclosurePage;
};

/**
 * Holds that the open document shows this route's own h1 and body text.
 *
 * Read by role and accessible name only, so it holds the same with or
 * without JavaScript.
 * @param screens - The Page Objects of the three kinds of content screen.
 * @param route - The route the browser is on.
 */
const expectOwnContent = async (screens: Screens, route: ContentRoute) => {
  const { guidePage, postalCodeGeneratorPage, privacyDisclosurePage } = screens;

  await expect(guidePage.topLevelHeadings(), route.path).toHaveCount(1);
  await expect(guidePage.notFoundHeading()).toHaveCount(0);

  if (route.screen === "generator") {
    await expect(postalCodeGeneratorPage.brandingHeading()).toBeVisible();
    await expect(postalCodeGeneratorPage.explanation()).toBeVisible();
    await expect(
      guidePage.headingOfRegion(guideSelectors.capabilitiesHeading),
    ).toBeVisible();
    return;
  }

  if (route.screen === "privacy") {
    await expect(privacyDisclosurePage.heading()).toBeVisible();
    for (const name of privacyDisclosurePage.sectionHeadings) {
      await expect(privacyDisclosurePage.headingOfSection(name)).toBeVisible();
      const text = await privacyDisclosurePage.section(name).innerText();
      expect(
        text.replace(name, "").trim().length,
        `body text under ${name}`,
      ).toBeGreaterThanOrEqual(minimumPrivacySectionText);
    }
    return;
  }

  await expect(guidePage.heading(route.name)).toBeVisible();
  const bodySections = (await guidePage.sectionHeadingNames()).filter(
    (name) => name !== guideSelectors.sourcesHeading,
  );
  expect(
    bodySections.length,
    `body sections of ${route.path}: ${JSON.stringify(bodySections)}`,
  ).toBeGreaterThanOrEqual(2);
  for (const name of bodySections) {
    expect(
      await guidePage.bodyTextLength(name),
      `body text under ${name}`,
    ).toBeGreaterThanOrEqual(minimumGuideSectionText);
  }
};

/**
 * Holds that the open document's head names this route: its title, one
 * non-empty meta description, and one canonical link to its production URL.
 * @param crawlablePage - The crawler's view of the page.
 * @param route - The route the browser is on.
 */
const expectOwnHead = async (
  crawlablePage: CrawlablePage,
  route: ContentRoute,
) => {
  expect(await crawlablePage.documentTitle(), route.path).toBe(route.title);

  await expect(crawlablePage.metaDescriptions(), route.path).toHaveCount(1);
  expect(await crawlablePage.metaDescription(), route.path).not.toBe("");

  await expect(crawlablePage.canonicalLinks(), route.path).toHaveCount(1);
  await expect(crawlablePage.canonicalLinks()).toHaveAttribute(
    "href",
    productionUrlOf(route.path),
  );
};

/**
 * A guide other than the one at this route, to navigate to in-app.
 * @param route - The route the browser is on.
 */
const anotherGuide = (route: ContentRoute) => {
  const guide = guides.find((candidate) => candidate.path !== route.path);

  if (!guide) {
    throw new Error("The guide list holds no other guide.");
  }

  return guide;
};

/**
 * The values a robots.txt gives one field, case-insensitively, in order.
 * @param robots - The robots.txt body.
 * @param field - The field name, such as Disallow.
 */
const robotsValues = (robots: string, field: string) =>
  robots
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .map((line) => /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line))
    .filter((match) => match !== null)
    .filter(([, name]) => name.toLowerCase() === field.toLowerCase())
    .map(([, , value]) => value.trim());

/**
 * The URLs a sitemap lists, in its order.
 * @param sitemap - The sitemap.xml body.
 */
const sitemapLocations = (sitemap: string) =>
  [...sitemap.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map(([, url]) => url);

test.describe("Issue #169: each content route answers with its own HTML, read without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test.beforeEach(async ({ advertisingPage }) => {
    await advertisingPage.failEveryAdvertisingRequest();
  });

  for (const route of contentRoutes) {
    test(`AC-2 ${route.path}: without JavaScript, the page shows its own h1 and body text, and names its title, meta description and canonical URL`, async ({
      crawlablePage,
      guidePage,
      postalCodeGeneratorPage,
      privacyDisclosurePage,
    }) => {
      expect(await crawlablePage.open(route.path)).toBe(200);

      await expectOwnContent(
        { guidePage, postalCodeGeneratorPage, privacyDisclosurePage },
        route,
      );
      await expectOwnHead(crawlablePage, route);
    });
  }

  test("AC-2 without JavaScript, no two of the seven pages share a meta description", async ({
    crawlablePage,
  }) => {
    const descriptions: Record<string, string> = {};

    for (const route of contentRoutes) {
      expect(await crawlablePage.open(route.path), route.path).toBe(200);
      descriptions[route.path] = await crawlablePage.metaDescription();
    }

    // One description shared by several pages describes none of them.
    expect(
      new Set(Object.values(descriptions)).size,
      JSON.stringify(descriptions),
    ).toBe(contentRoutes.length);
  });

  test("AC-6 without JavaScript, an unknown path answers 404 with the not-found screen", async ({
    crawlablePage,
    notFoundPage,
  }) => {
    expect(await crawlablePage.open(unknownContentPath)).toBe(404);

    await expect(notFoundPage.heading()).toBeVisible();
    await expect(notFoundPage.backToGeneratorLink()).toBeVisible();
  });
});

test.describe("Issue #169: what a crawler fetches", () => {
  test("AC-2 each of the seven routes answers 200 with HTML, and no two answers are identical", async ({
    crawlablePage,
  }) => {
    const answers: RawResponse[] = [];
    for (const route of contentRoutes) {
      answers.push(await crawlablePage.fetchRaw(route.path));
    }

    expect(
      answers.map(({ path, status, contentType }) => ({
        path,
        status,
        html: /^text\/html\b/i.test(contentType),
      })),
    ).toEqual(
      contentRoutes.map(({ path }) => ({ path, status: 200, html: true })),
    );

    const identical = answers.flatMap((answer, index) =>
      answers
        .slice(index + 1)
        .filter((other) => other.body === answer.body)
        .map((other) => `${answer.path} = ${other.path}`),
    );
    expect(identical).toEqual([]);
  });

  test("AC-4 /robots.txt answers 200 as text/plain, allows every crawler and names the sitemap", async ({
    crawlablePage,
  }) => {
    const robots = await crawlablePage.fetchRaw("/robots.txt");

    expect(robots.status).toBe(200);
    expect(robots.contentType).toMatch(/^text\/plain\b/i);

    expect(robotsValues(robots.body, "User-agent")).toContain("*");
    // Nothing is shut off from a crawler: no rule disallows the whole site.
    expect(
      robotsValues(robots.body, "Disallow").filter((value) =>
        /^\/\*?$/.test(value),
      ),
    ).toEqual([]);
    expect(robotsValues(robots.body, "Sitemap")).toEqual([sitemapUrl]);
  });

  test("AC-5 /sitemap.xml answers 200 as XML and lists exactly the seven content routes as production URLs", async ({
    crawlablePage,
  }) => {
    const sitemap = await crawlablePage.fetchRaw("/sitemap.xml");

    expect(sitemap.status).toBe(200);
    expect(sitemap.contentType).toMatch(/^(?:application|text)\/xml\b/i);
    expect(sitemap.body).toMatch(/<urlset\b/);

    expect([...sitemapLocations(sitemap.body)].sort()).toEqual(
      contentRoutes.map(({ path }) => productionUrlOf(path)).sort(),
    );
  });

  test("AC-6 an unknown path answers HTTP 404 with HTML, not the generator's 200", async ({
    crawlablePage,
  }) => {
    const unknown = await crawlablePage.fetchRaw(unknownContentPath);

    expect(unknown.status).toBe(404);
    expect(unknown.contentType).toMatch(/^text\/html\b/i);

    const home = await crawlablePage.fetchRaw("/");
    expect(unknown.body).not.toBe(home.body);
  });

  test("AC-8 no content route's HTML and not the 404 page load the AdSense loader", async ({
    crawlablePage,
  }) => {
    const paths = [
      ...contentRoutes.map(({ path }) => path),
      unknownContentPath,
    ];
    const loading: string[] = [];

    for (const path of paths) {
      const answer = await crawlablePage.fetchRaw(path);
      if (adSenseLoaderReference.test(answer.body)) loading.push(path);
    }

    expect(loading).toEqual([]);
  });
});

test.describe("Issue #169: once the client loads, every content page behaves as before", () => {
  test.beforeEach(async ({ advertisingPage, postalCodeGeneratorPage }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
  });

  for (const route of contentRoutes) {
    test(`AC-3 ${route.path}: direct navigation, a refresh, in-app navigation and a generation work with no console error`, async ({
      crawlablePage,
      guidePage,
      headerLogoPage,
      postalCodeGeneratorPage,
      privacyDisclosurePage,
    }) => {
      const screens = {
        guidePage,
        postalCodeGeneratorPage,
        privacyDisclosurePage,
      };

      expect(await crawlablePage.open(route.path)).toBe(200);
      await expectOwnContent(screens, route);
      await expect.poll(() => crawlablePage.documentTitle()).toBe(route.title);

      expect(await crawlablePage.reload()).toBe(200);
      expect(crawlablePage.currentPath()).toBe(route.path);
      await expectOwnContent(screens, route);

      // From here on the router answers: no further document is loaded.
      const documentsBefore = crawlablePage.documentRequestCount();

      const next = anotherGuide(route);
      await guidePage.follow(guidePage.footerGuideLink(next.name));
      await expect.poll(() => crawlablePage.currentPath()).toBe(next.path);
      await expect(guidePage.heading(next.name)).toBeVisible();
      await expect
        .poll(() => crawlablePage.documentTitle())
        .toBe(`${next.name}${guideSelectors.titleSuffix}`);

      await guidePage.follow(headerLogoPage.wordmark());
      await expect.poll(() => crawlablePage.currentPath()).toBe("/");
      await expect(postalCodeGeneratorPage.startAction()).toBeVisible();

      await postalCodeGeneratorPage.generate();
      await expect(
        postalCodeGeneratorPage.postalCodeDisplay(result.postalCode),
      ).toBeVisible();

      expect(crawlablePage.documentRequestCount()).toBe(documentsBefore);
      expect(crawlablePage.consoleProblemsSoFar()).toEqual([]);
    });
  }

  test("AC-6 an unknown path answers 404 and, once the client loads, shows the not-found screen with its way back, with no console error", async ({
    crawlablePage,
    notFoundPage,
    postalCodeGeneratorPage,
  }) => {
    expect(await crawlablePage.open(unknownContentPath)).toBe(404);

    await expect(notFoundPage.heading()).toBeVisible();
    await expect(notFoundPage.header()).toBeVisible();
    await expect(notFoundPage.attribution()).toBeVisible();

    await notFoundPage.backToGeneratorLink().click();
    await expect.poll(() => crawlablePage.currentPath()).toBe("/");
    await expect(postalCodeGeneratorPage.startAction()).toBeVisible();

    expect(crawlablePage.consoleProblemsSoFar()).toEqual([]);
  });
});
