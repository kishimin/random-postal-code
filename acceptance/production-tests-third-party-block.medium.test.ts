import {
  expect,
  test as productionTest,
} from "../apps/web/frontend/e2e/production/fixtures.ts";
import {
  createProductionProbePage,
  type ProbeRequest,
  type ProductionProbePage,
} from "./pages/production-probe-page.ts";

/*
 * Acceptance test for Issue #104, criterion "Every production test aborts
 * browser requests to the AdSense, consent, and Google Analytics hosts before
 * the page loads, so no ad is requested and no visit is recorded."
 *
 * Why it drives the production fixture rather than production
 * ------------------------------------------------------------
 * The production tests run only against the deployed site. What makes them
 * safe to run there is the browser they are handed, and every one of them
 * takes it from e2e/production/fixtures.ts (production-tests.medium.test.ts
 * holds that). So this test takes the same `page` from the same fixture and
 * loads a document of its own that asks for each host in its markup. A
 * request the markup makes is sent while the document is still loading, so
 * only blocking that is in place before navigation stops it.
 *
 * The hosts are the ones the Web MVP's tags use: the AdSense loader and its
 * ad server, Google's consent message, the Google tag, and the GA4
 * collection endpoint (design.md section 12, Issues #9, #39, #92). A request
 * that is not blocked would leave for the real host, which is what the
 * criterion forbids, so passing means none of them received anything.
 */

const blockedRequests: readonly ProbeRequest[] = [
  {
    host: "AdSense loader",
    url: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000",
    tag: "script",
  },
  {
    host: "AdSense ad server",
    url: "https://googleads.g.doubleclick.net/pagead/ads?client=ca-pub-0000000000000000",
    tag: "img",
  },
  {
    host: "consent message",
    url: "https://fundingchoicesmessages.google.com/i/pub-0000000000000000?ers=1",
    tag: "script",
  },
  {
    host: "Google tag",
    url: "https://www.googletagmanager.com/gtag/js?id=G-ATDD000104",
    tag: "script",
  },
  {
    host: "GA4 collection",
    url: "https://region1.google-analytics.com/g/collect?v=2&tid=G-ATDD000104",
    tag: "img",
  },
];

const test = productionTest.extend<{ probePage: ProductionProbePage }>({
  probePage: async ({ page }, use) => {
    await use(createProductionProbePage(page));
  },
});

test("Issue #104: the production test browser aborts advertising, consent, and Analytics requests made while the page loads", async ({
  probePage,
}) => {
  await probePage.navigate(blockedRequests);

  // Sent, so "blocked" is not "never asked for"; failed, so it was stopped;
  // never answered, so no host received it.
  await expect
    .poll(() => probePage.outcomes())
    .toEqual(
      blockedRequests.map(({ host }) => ({
        host,
        sent: true,
        failed: true,
        answered: false,
      })),
    );
});
