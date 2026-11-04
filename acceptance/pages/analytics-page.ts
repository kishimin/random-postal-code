import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { Page, Route } from "@playwright/test";
import {
  analyticsRequestPattern,
  analyticsTagPattern,
  analyticsTagSubstitute,
} from "../selectors/analytics-selectors.ts";
import { shellSelectors } from "../selectors/shell-selectors.ts";

/** One entry of the page data layer, as gtag.js would read it. */
export type DataLayerEntry =
  { readonly command: readonly unknown[] } | { readonly object: unknown };

/**
 * Page Object for the Google Analytics boundary Issue #92 adds.
 *
 * Everything is observed at the network boundary and on the data layer, the
 * queue gtag.js documents as its input: which tag the page requests, with
 * which measurement ID, and which commands the page queues for it. Nothing
 * about how the application wires the tag in is assumed.
 * @param page - The Playwright page driving the browser.
 */
export const createAnalyticsPage = (page: Page) => {
  const tagRequestUrls: string[] = [];
  const analyticsRequestUrls: string[] = [];
  const heldTagRoutes: Route[] = [];
  let answeredTagRequests = 0;

  page.on("request", (request) => {
    const url = request.url();
    if (analyticsTagPattern.test(url)) tagRequestUrls.push(url);
    if (analyticsRequestPattern.test(url)) analyticsRequestUrls.push(url);
  });
  page.on("requestfinished", (request) => {
    if (analyticsTagPattern.test(request.url())) answeredTagRequests += 1;
  });

  /**
   * Serves a production build from disk in place of the preview server.
   *
   * The preview server serves the build CI made, which has no measurement ID
   * (Issue #92: only production carries one). The build with an ID is served
   * from the same origin instead, so every Page Object that navigates to a
   * path keeps working unchanged. Unknown paths get index.html, the SPA
   * fallback Pages also applies.
   * @param outDir - The directory the build was written to.
   * @param origin - The origin the page navigates to.
   */
  const serveBuild = (outDir: string, origin: string) =>
    page.route(
      (url) => url.origin === origin,
      (route) => {
        const { pathname } = new URL(route.request().url());
        const candidate = path.join(outDir, decodeURIComponent(pathname));
        const isBuiltFile =
          candidate.startsWith(outDir) &&
          existsSync(candidate) &&
          statSync(candidate).isFile();

        return route.fulfill({
          path: isBuiltFile ? candidate : path.join(outDir, "index.html"),
        });
      },
    );

  /** Answers the tag loader with a substitute. Call before navigating. */
  const answerTag = () =>
    page.route(analyticsTagPattern, (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/javascript; charset=utf-8" },
        body: analyticsTagSubstitute,
      }),
    );

  /** The tag loader fails on the server side. Call before navigating. */
  const failTag = () =>
    page.route(analyticsTagPattern, (route) =>
      route.fulfill({ status: 503, body: "Service Unavailable" }),
    );

  /** The tag loader is blocked, as an extension would block it. */
  const blockTag = () =>
    page.route(analyticsTagPattern, (route) => route.abort("blockedbyclient"));

  /** The tag loader never answers, until teardown ends it. */
  const holdTag = () =>
    page.route(analyticsTagPattern, (route) => {
      heldTagRoutes.push(route);
    });

  // Ends every held tag request as a failure, so none is open at close.
  const releaseHeldTag = async () => {
    const held = heldTagRoutes.splice(0);
    await Promise.all(held.map((route) => route.abort("failed")));
  };

  const tagRequestCount = () => tagRequestUrls.length;

  const answeredTagRequestCount = () => answeredTagRequests;

  const analyticsRequests = (): readonly string[] => [...analyticsRequestUrls];

  /** The measurement IDs the page asked the tag loader for. */
  const requestedMeasurementIds = () =>
    tagRequestUrls.map((url) => new URL(url).searchParams.get("id"));

  /*
   * The data layer the requested tag reads.
   *
   * gtag.js reads window.dataLayer unless its URL names another layer with
   * the l parameter, so the name comes from the request the page made.
   */
  const dataLayerName = () =>
    tagRequestUrls
      .map((url) => new URL(url).searchParams.get("l"))
      .find((name) => name !== null && name !== "") ?? "dataLayer";

  /*
   * Every entry on the data layer, in order.
   *
   * gtag() pushes its arguments object, so an entry that is array-like is a
   * command such as ["consent", "default", {...}] or ["config", id]. Anything
   * else is an object pushed directly, the form a Tag Manager event takes.
   */
  const dataLayerEntries = (): Promise<DataLayerEntry[]> =>
    page.evaluate((name) => {
      const layer: unknown = Reflect.get(window, name);
      if (!Array.isArray(layer)) return [];

      return layer.map((entry: unknown) =>
        entry !== null &&
        typeof entry === "object" &&
        typeof Reflect.get(entry, "length") === "number"
          ? {
              command: Array.from(
                { length: Number(Reflect.get(entry, "length")) },
                (_, index) => {
                  const value: unknown = Reflect.get(entry, index);
                  return value instanceof Date ? "<date>" : value;
                },
              ),
            }
          : { object: entry },
      );
    }, dataLayerName());

  /*
   * Marks the current document, so a later check can tell a same-document
   * navigation (History API) from a full page load.
   */
  const markDocument = () =>
    page.evaluate(() => {
      Reflect.set(window, "__zipnamiDocumentMark", "issue-92");
    });

  const isSameDocument = () =>
    page.evaluate(
      () => Reflect.get(window, "__zipnamiDocumentMark") === "issue-92",
    );

  // Moving between screens the way a visitor does: through the links.
  const followPrivacyLink = () =>
    page
      .getByRole("link", { name: shellSelectors.privacyHeading })
      .first()
      .click();

  const followHomeLink = () =>
    page.getByRole("link", { name: shellSelectors.siteName }).first().click();

  const goBack = () => page.goBack();

  /*
   * Opens the generator without waiting for the load event: a tag that never
   * answers may hold it open, and a visitor does not wait for it either.
   */
  const openGeneratorWithoutWaitingForLoad = () =>
    page.goto("/", { waitUntil: "domcontentloaded" });

  /** The src of every script element in the document. */
  const scriptSources = () =>
    page.evaluate(() => Array.from(document.scripts, (script) => script.src));

  return {
    serveBuild,
    answerTag,
    failTag,
    blockTag,
    holdTag,
    releaseHeldTag,
    tagRequestCount,
    answeredTagRequestCount,
    analyticsRequests,
    requestedMeasurementIds,
    dataLayerEntries,
    markDocument,
    isSameDocument,
    followPrivacyLink,
    followHomeLink,
    goBack,
    openGeneratorWithoutWaitingForLoad,
    scriptSources,
  };
};

export type AnalyticsPage = ReturnType<typeof createAnalyticsPage>;
