import type { Page, Route } from "@playwright/test";
import type { Address, PostalCode } from "@zipnami/shared";
import {
  anyDisplayedPostalCode,
  displayedPostalCode,
  generatorSelectors,
  liveRegionSelector,
  randomEndpointPattern,
} from "../selectors/generator-selectors.ts";

/** One answer the stubbed `GET /api/random` gives, in the order it is queued. */
export type StubbedResponse =
  | { readonly outcome: "result"; readonly result: PostalCode }
  | { readonly outcome: "unavailable" };

/**
 * Queues a successful response carrying the given postal code.
 * @param result - The postal code and addresses the endpoint returns.
 */
export const respondWith = (result: PostalCode): StubbedResponse => ({
  outcome: "result",
  result,
});

/**
 * Queues the `503 DATA_UNAVAILABLE` answer api-design.md section 4.2 defines.
 */
export const respondUnavailable = (): StubbedResponse => ({
  outcome: "unavailable",
});

// api-design.md section 4.1. no-store matters to the test as much as to the
// product: without it a browser may serve the second generation from cache and
// the request count would measure caching rather than behavior. The permissive
// CORS header stands in for the exact allowlist the deployed Worker applies
// (api-design.md section 6); the browser would otherwise block a response from
// the API origin the build baked in.
const responseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
} as const;

const dataUnavailableBody = JSON.stringify({
  error: {
    code: "DATA_UNAVAILABLE",
    message: "Postal code data is temporarily unavailable.",
    requestId: "01JEXAMPLE0000000000000000",
  },
});

type ClipboardRecorder = { __zipnamiClipboardWrites?: string[] };

/**
 * Page Object for the random postal-code experience on the generator route.
 *
 * The endpoint is answered here rather than by a running backend: Issue #6 is
 * about what a visitor sees for a given response, and a real service would make
 * the result unknown to the test. The stub sits at the network boundary, so
 * nothing about the client's internals is assumed.
 * @param page - The Playwright page driving the browser.
 */
export const createPostalCodeGeneratorPage = (page: Page) => {
  const queuedResponses: StubbedResponse[] = [];
  let randomRequests = 0;
  let heldResponses: Promise<void> | undefined;
  let releaseHeld: (() => void) | undefined;

  const answerPreflight = (route: Route) =>
    route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,OPTIONS",
        "access-control-allow-headers": "accept,content-type",
      },
    });

  // The last queued response repeats once the queue is down to it, so a test
  // that only cares about one answer does not have to queue one per request.
  const nextResponse = () =>
    queuedResponses.length > 1
      ? queuedResponses.shift()
      : queuedResponses.at(0);

  const answerRandomRequest = async (route: Route) => {
    // Counted before the hold so a duplicate activation during a generation is
    // visible while the first request is still in flight.
    randomRequests += 1;

    if (heldResponses) {
      await heldResponses;
    }

    const response = nextResponse();
    if (response?.outcome === "result") {
      await route.fulfill({
        status: 200,
        headers: responseHeaders,
        body: JSON.stringify(response.result),
      });
      return;
    }

    await route.fulfill({
      status: 503,
      headers: responseHeaders,
      body: dataUnavailableBody,
    });
  };

  /**
   * Installs the stub. Call before navigating.
   * @param responses - The answers the endpoint gives, in order.
   */
  const stubRandomEndpoint = async (responses: readonly StubbedResponse[]) => {
    queuedResponses.length = 0;
    queuedResponses.push(...responses);
    randomRequests = 0;

    await page.route(randomEndpointPattern, (route) =>
      route.request().method() === "OPTIONS"
        ? answerPreflight(route)
        : answerRandomRequest(route),
    );
  };

  // Holds every answer until released, which is how the loading state is
  // reached without a timer the test would have to guess the length of.
  const holdResponses = () => {
    heldResponses = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
  };

  const releaseResponses = () => {
    releaseHeld?.();
    heldResponses = undefined;
  };

  const randomRequestCount = () => randomRequests;

  /*
   * Records what the page hands to the platform clipboard.
   *
   * Reading the real clipboard back needs a permission grant that not every
   * browser in this suite supports, and this observes the same boundary: the
   * value the page asks the operating system to hold. Call before navigating.
   */
  const recordClipboardWrites = () =>
    page.addInitScript(() => {
      const writes: string[] = [];
      (window as unknown as ClipboardRecorder).__zipnamiClipboardWrites =
        writes;

      const record = (text: string) => {
        writes.push(text);
        return Promise.resolve();
      };

      if (navigator.clipboard) {
        navigator.clipboard.writeText = record;
        return;
      }

      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: record },
      });
    });

  const clipboardWrites = () =>
    page.evaluate(
      () =>
        (window as unknown as ClipboardRecorder).__zipnamiClipboardWrites ?? [],
    );

  const navigate = () => page.goto("/");

  const main = () => page.getByRole("main");

  const brandingHeading = () =>
    page.getByRole("heading", { name: generatorSelectors.siteName, level: 1 });

  // A paragraph rather than any text carrying the word: the generate action's
  // label contains it too, and an action is not an explanation.
  const explanation = () =>
    main()
      .getByRole("paragraph")
      .filter({ hasText: generatorSelectors.explanation })
      .first();

  const generateAction = () =>
    page.getByRole("button", { name: generatorSelectors.generateAction });

  const copyAction = () =>
    page.getByRole("button", { name: generatorSelectors.copyAction });

  const navigationLink = () =>
    page.getByRole("link", { name: generatorSelectors.navigationLink });

  /*
   * Resolves to the main landmark when it shows this postal code, and to
   * nothing when it does not.
   *
   * Filtering the landmark rather than locating the text itself keeps the
   * assertion away from how the result is marked up: a text locator matches
   * every ancestor that contains it as well, which would make the test fail on
   * an extra wrapper rather than on a missing result.
   */
  const postalCodeDisplay = (postalCode: string) =>
    main().filter({ hasText: displayedPostalCode(postalCode) });

  const anyPostalCodeDisplay = () =>
    main().filter({ hasText: anyDisplayedPostalCode });

  // ui-design.md section 8 asks for native list semantics, so one entry holds
  // one address. All three fields are required of the same entry: an
  // implementation that showed the prefectures of one address and the towns of
  // another would otherwise pass.
  const addressEntry = (address: Address) =>
    main()
      .getByRole("listitem")
      .filter({ hasText: address.prefecture })
      .filter({ hasText: address.city })
      .filter({ hasText: address.town });

  const liveRegions = () => page.locator(liveRegionSelector);

  const announcementOf = (postalCode: string) =>
    liveRegions().filter({ hasText: displayedPostalCode(postalCode) });

  const announcementText = async () =>
    (await liveRegions().allTextContents()).join(" ").trim();

  const generate = () => generateAction().click();

  // Bypasses the actionability wait on purpose. The point is what a second
  // activation during a generation does, and waiting for the action to become
  // usable again would answer a different question — or hang.
  const attemptDuplicateGeneration = () =>
    generateAction().click({ force: true });

  const copy = () => copyAction().click();

  // press() focuses the control and sends real key events, which a control
  // that only answers a mouse click does not act on.
  const generateWithKeyboard = () => generateAction().press("Enter");

  const copyWithKeyboard = () => copyAction().press("Enter");

  return {
    stubRandomEndpoint,
    holdResponses,
    releaseResponses,
    randomRequestCount,
    recordClipboardWrites,
    clipboardWrites,
    navigate,
    brandingHeading,
    explanation,
    generateAction,
    copyAction,
    navigationLink,
    postalCodeDisplay,
    anyPostalCodeDisplay,
    addressEntry,
    announcementOf,
    announcementText,
    generate,
    attemptDuplicateGeneration,
    copy,
    generateWithKeyboard,
    copyWithKeyboard,
  };
};

export type PostalCodeGeneratorPage = ReturnType<
  typeof createPostalCodeGeneratorPage
>;
