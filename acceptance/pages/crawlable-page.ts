import type { APIRequestContext, ConsoleMessage, Page } from "@playwright/test";

/** What the site answered for one path, read the way a crawler reads it. */
export type RawResponse = {
  readonly path: string;
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
};

/**
 * Page Object for what a crawler and a returning visitor see of a content
 * page (Issue #169).
 *
 * Two kinds of observation live here. One is the HTTP answer itself — the
 * status, the content type, the bytes — fetched without a browser, so no
 * JavaScript can run. The other is the document's head as a crawler reads
 * it: the canonical link and the meta description are public contracts of
 * the document (what a search engine reads), not Zipnami's markup, so they
 * are located by their standard names.
 *
 * Everything a test asks of the browser is located with locators rather than
 * page.evaluate, so the same calls work in a context with JavaScript
 * disabled.
 * @param page - The Playwright page driving the browser.
 * @param request - An HTTP client on the same base URL, with no browser.
 */
export const createCrawlablePage = (page: Page, request: APIRequestContext) => {
  let documentRequests = 0;
  const consoleProblems: string[] = [];

  // Full page loads of the top-level document. An in-app navigation makes
  // none; a reload or a link the router does not handle makes one.
  page.on("request", (sent) => {
    if (sent.isNavigationRequest() && sent.frame() === page.mainFrame()) {
      documentRequests += 1;
    }
  });

  /*
   * A failed subresource is the network's report, not the page's: every
   * advertising request is refused in these tests, and a 404 document is the
   * answer under test. Anything else the console reports as an error is a
   * problem of the page, a hydration mismatch included.
   */
  const isNetworkReport = (message: ConsoleMessage) =>
    /^Failed to load resource\b/.test(message.text());

  page.on("console", (message) => {
    if (message.type() === "error" && !isNetworkReport(message)) {
      consoleProblems.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleProblems.push(`uncaught: ${error.message}`);
  });

  /**
   * Fetches a path without a browser: no JavaScript runs, as for a crawler.
   * @param path - The path to request.
   */
  const fetchRaw = async (path: string): Promise<RawResponse> => {
    const response = await request.get(path, { maxRedirects: 0 });

    return {
      path,
      status: response.status(),
      contentType: response.headers()["content-type"] ?? "",
      body: await response.text(),
    };
  };

  /**
   * Opens a path in the browser and reports the status the document came
   * with.
   * @param path - The path to open.
   */
  const open = async (path: string) => (await page.goto(path))?.status() ?? 0;

  const reload = async () => (await page.reload())?.status() ?? 0;

  const currentPath = () => new URL(page.url()).pathname;

  const documentTitle = () => page.title();

  // The head's canonical links. A page carries exactly one.
  const canonicalLinks = () => page.locator('head link[rel="canonical"]');

  // The head's meta descriptions. A page carries exactly one.
  const metaDescriptions = () => page.locator('head meta[name="description"]');

  const metaDescription = async () =>
    ((await metaDescriptions().first().getAttribute("content")) ?? "").trim();

  const documentRequestCount = () => documentRequests;

  // A copy, so a test compares what had happened by the time it asked.
  const consoleProblemsSoFar = () => [...consoleProblems];

  return {
    fetchRaw,
    open,
    reload,
    currentPath,
    documentTitle,
    canonicalLinks,
    metaDescriptions,
    metaDescription,
    documentRequestCount,
    consoleProblemsSoFar,
  };
};

export type CrawlablePage = ReturnType<typeof createCrawlablePage>;
