import type { Page, Request, Response } from "@playwright/test";
import type { Address } from "@zipnami/shared";
import { randomEndpointPattern } from "../selectors/generator-selectors.ts";
import {
  externalMapLinkSelector,
  mapAddressQuery,
  mapSelectors,
} from "../selectors/map-selectors.ts";
import { createAccessibilityPage } from "./accessibility-page.ts";
import { createAddressMapPage } from "./address-map-page.ts";
import { createDependencyFailurePage } from "./dependency-failure-page.ts";
import { createGenerationHistoryPage } from "./generation-history-page.ts";

/** What the Worker answered one generation with, as the browser received it. */
export type WorkerAnswer = {
  readonly status: number;
  /** The origin the page called: the Worker's, baked in by VITE_API_BASE_URL. */
  readonly apiOrigin: string;
  /** The origin of the page that called it: the preview of the production build. */
  readonly pageOrigin: string;
  readonly body: unknown;
};

/** How the Worker answered a request made as some browser origin. */
export type CorsAnswer = {
  readonly status: number;
  /** `access-control-allow-origin` as sent, or null when the Worker sent none. */
  readonly allowedOrigin: string | null;
};

/** What a script running on some origin got back when it tried to read the Worker. */
export type CrossOriginRead = "read" | "refused" | `status ${number}`;

/*
 * Paths only a development server serves. A production build bundles every
 * module into hashed files, so a page that requests any of these is being
 * served by `vite` (or another dev server), not by a preview of `vite build`.
 */
const developmentServerPathPattern =
  /^\/(?:@vite\/|@react-refresh|@fs\/|src\/|node_modules\/)/;

const otherSiteDocument =
  '<!doctype html><html lang="en"><title>Another site</title><body></body></html>';

/**
 * Page Object for the Issue #21 end-to-end journeys against a real local
 * stack: the production build served by `vite preview`, calling a Worker
 * running under `wrangler dev`.
 *
 * It composes the Page Objects earlier Issues already hold rather than
 * restating them, and adds only what a real backend changes: the result is
 * not known in advance, so every generation is read back from the Worker's
 * answer, and what the screen shows is compared against that.
 *
 * Nothing here answers `GET /api/random`. The composed Page Objects can stub
 * it, and this one never asks them to, so each generation is a real round
 * trip to the Worker.
 * @param page - The Playwright page driving the browser.
 */
export const createWebMvpJourneyPage = (page: Page) => {
  const maps = createAddressMapPage(page);
  const history = createGenerationHistoryPage(page);
  const accessibility = createAccessibilityPage(page);
  const dependencies = createDependencyFailurePage(page);
  const requestedPaths: string[] = [];
  let apiOrigin: string | undefined;

  const isWorkerGeneration = (response: Response) =>
    randomEndpointPattern.test(new URL(response.url()).pathname) &&
    response.request().method() === "GET";

  const pageOrigin = () => new URL(page.url()).origin;

  /** The Worker's origin, learned from the first generation the page made. */
  const workerOrigin = () => {
    if (apiOrigin === undefined) {
      throw new Error(
        "Generate once before asking for the Worker: its origin is read from the request the page makes.",
      );
    }

    return apiOrigin;
  };

  const workerGenerationUrl = () => `${workerOrigin()}/api/random`;

  /**
   * Generates once and returns what the Worker answered.
   *
   * The response is awaited rather than the screen, because the screen can
   * only be checked against what the Worker said once that is known.
   */
  const generateThroughWorker = async (): Promise<WorkerAnswer> => {
    const answered = page.waitForResponse(isWorkerGeneration);
    await maps.generate();
    const response = await answered;
    const body: unknown = await response.json().catch(() => null);

    apiOrigin = new URL(response.url()).origin;

    return {
      status: response.status(),
      apiOrigin,
      pageOrigin: pageOrigin(),
      body,
    };
  };

  /**
   * Generates the given number of times and returns each postal code the
   * Worker answered with, oldest first.
   *
   * Each generation waits for its code to reach the screen before the next
   * starts: Issue #6 refuses a second activation while one is in flight, so
   * clicking ahead would silently produce fewer generations than asked for.
   * @param times - How many generations to make.
   */
  const generateTimes = async (times: number) => {
    const postalCodes: string[] = [];

    for (let generation = 0; generation < times; generation += 1) {
      const answer = await generateThroughWorker();
      const { postalCode } = answer.body as { postalCode: string };
      await maps.postalCodeDisplay(postalCode).waitFor();
      postalCodes.push(postalCode);
    }

    return postalCodes;
  };

  /*
   * The current result: the same test id the Issue #6 Page Object narrows
   * the displayed postal code to, since Issue #7 put a history inside main.
   */
  const resultRegion = () =>
    page.getByRole("main").getByTestId("result-region");

  /*
   * One address of the current result, with all three fields in the same
   * entry.
   *
   * Scoped to the current result rather than the whole main landmark: the
   * history (Issue #7) lists the same addresses again inside main, and an
   * address matched there would satisfy "the result shows it" without the
   * result showing anything.
   */
  const resultAddressEntry = (address: Address) =>
    resultRegion()
      .getByRole("listitem")
      .filter({ hasText: address.prefecture })
      .filter({ hasText: address.city })
      .filter({ hasText: address.town });

  const resultMapSelectionAction = (address: Address) =>
    resultAddressEntry(address).getByRole("button", {
      name: mapSelectors.selectMapTarget,
    });

  const selectResultMapTarget = (address: Address) =>
    resultMapSelectionAction(address).click();

  const resultExternalMapLinks = (address: Address) =>
    resultAddressEntry(address).locator(externalMapLinkSelector);

  /*
   * The addresses this result's external Google Maps links ask for, decoded
   * from the `href` values as written.
   */
  const resultExternalMapAddresses = async (address: Address) =>
    (
      await resultExternalMapLinks(address).evaluateAll((links) =>
        links.map((link) => link.getAttribute("href") ?? ""),
      )
    ).map(mapAddressQuery);

  /*
   * Loses and restores the connection the way a visitor does: the page stays
   * loaded, and every request it makes from now on fails before a server
   * sees it.
   *
   * The Worker request is also refused at the route while offline, as the
   * Issue #17 Page Object does, because not every engine applies offline
   * emulation to a loopback address, and a request that still reached the
   * local Worker would make "offline" mean nothing.
   */
  const goOffline = async () => {
    await page.route(randomEndpointPattern, (route) =>
      route.abort("internetdisconnected"),
    );
    await page.context().setOffline(true);
  };

  const goOnline = async () => {
    await page.context().setOffline(false);
    await page.unroute(randomEndpointPattern);
  };

  /**
   * Asks the Worker for a postal code as a browser on the given origin
   * would, and returns which origin, if any, the Worker authorized.
   *
   * Sent from outside the page so the Origin header can be any value: what
   * is observed is the Worker's own answer, which is what a browser enforces.
   * @param origin - The browser origin the request claims to come from.
   * @param kind - A plain read, or the preflight a browser sends before one.
   */
  const askWorkerAs = async (
    origin: string,
    kind: "read" | "preflight",
  ): Promise<CorsAnswer> => {
    const response = await page.request.fetch(workerGenerationUrl(), {
      method: kind === "read" ? "GET" : "OPTIONS",
      headers:
        kind === "read"
          ? { origin }
          : { origin, "access-control-request-method": "GET" },
      failOnStatusCode: false,
    });

    return {
      status: response.status(),
      allowedOrigin: response.headers()["access-control-allow-origin"] ?? null,
    };
  };

  const readWorkerFromScript = () =>
    page.evaluate(async (url): Promise<CrossOriginRead> => {
      try {
        const response = await fetch(url);
        return response.ok ? "read" : `status ${response.status}`;
      } catch {
        return "refused";
      }
    }, workerGenerationUrl());

  /**
   * Opens a page on another origin and has a script there try to read the
   * Worker, so the browser itself decides whether CORS lets it.
   *
   * The other site is answered at the route, so no server has to exist on
   * that origin; the request to the Worker is not, so the Worker's real
   * answer is what the browser judges.
   * @param origin - The origin of the other site, with no trailing slash.
   */
  const readWorkerFrom = async (origin: string) => {
    await page.route(`${origin}/**`, (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: otherSiteDocument,
      }),
    );
    await page.goto(`${origin}/`);

    return readWorkerFromScript();
  };

  /** The same read, made by a script on the site's own origin. */
  const readWorkerFromThisSite = async () => {
    await maps.navigate();
    return readWorkerFromScript();
  };

  const rememberRequestedPath = (request: Request) => {
    const url = new URL(request.url());
    if (url.origin === pageOrigin()) {
      requestedPaths.push(url.pathname);
    }
  };

  /** Starts recording which paths the page requests from its own origin. */
  const recordSiteRequests = () => {
    page.on("request", rememberRequestedPath);
  };

  const developmentServerRequests = () =>
    requestedPaths.filter((path) => developmentServerPathPattern.test(path));

  const siteRequestPaths = (): readonly string[] => [...requestedPaths];

  return {
    ...maps,
    reload: history.reload,
    historyPostalCodes: history.historyPostalCodes,
    historyEntries: history.historyEntries,
    resizeTo: accessibility.resizeTo,
    hasHorizontalOverflow: accessibility.hasHorizontalOverflow,
    scanForViolations: accessibility.scanForViolations,
    holdEveryAdvertisingRequest: dependencies.holdEveryAdvertisingRequest,
    advertisingRequestCount: dependencies.advertisingRequestCount,
    releaseHeldAdvertisingRequests: dependencies.releaseHeldAdvertisingRequests,
    generateThroughWorker,
    generateTimes,
    resultAddressEntry,
    resultMapSelectionAction,
    selectResultMapTarget,
    resultExternalMapLinks,
    resultExternalMapAddresses,
    goOffline,
    goOnline,
    askWorkerAs,
    readWorkerFrom,
    readWorkerFromThisSite,
    recordSiteRequests,
    developmentServerRequests,
    siteRequestPaths,
    pageOrigin,
  };
};

export type WebMvpJourneyPage = ReturnType<typeof createWebMvpJourneyPage>;
