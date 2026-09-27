import type { Page, Route } from "@playwright/test";
import type { PostalCode } from "@zipnami/shared";
import {
  advertisingRequestPattern,
  advertisingScriptPattern,
} from "../selectors/advertising-selectors.ts";
import {
  isThirdPartyRequest,
  nonJsonBody,
  schemaViolatingBody,
  throwingAdvertisingSdk,
} from "../selectors/dependency-failure-selectors.ts";
import { randomEndpointPattern } from "../selectors/generator-selectors.ts";

/** One answer the stubbed `GET /api/random` gives, in the order it is queued. */
export type EndpointAnswer =
  | { readonly outcome: "result"; readonly result: PostalCode }
  | { readonly outcome: "data-unavailable" }
  | { readonly outcome: "internal-error" }
  | { readonly outcome: "schema-violating-body" }
  | { readonly outcome: "non-json-body" };

/**
 * A successful response carrying the given postal code.
 * @param result - The postal code and addresses the endpoint returns.
 */
export const answerWith = (result: PostalCode): EndpointAnswer => ({
  outcome: "result",
  result,
});

/** The postal-data failure: api-design.md section 4.2's `503 DATA_UNAVAILABLE`. */
export const answerDataUnavailable = (): EndpointAnswer => ({
  outcome: "data-unavailable",
});

/** The API's own failure: api-design.md section 4.2's `500 INTERNAL_ERROR`. */
export const answerInternalError = (): EndpointAnswer => ({
  outcome: "internal-error",
});

/** A `200` whose JSON body is not a postal code. */
export const answerSchemaViolatingBody = (): EndpointAnswer => ({
  outcome: "schema-violating-body",
});

/** A `200` whose body is not JSON at all. */
export const answerNonJsonBody = (): EndpointAnswer => ({
  outcome: "non-json-body",
});

// Same reasons as the Issue #6 Page Object: no-store keeps the request count a
// measure of behavior rather than of caching, and the permissive CORS header
// stands in for the deployed Worker's exact allowlist.
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
} as const;

const errorEnvelope = (code: string, message: string) =>
  JSON.stringify({
    error: { code, message, requestId: "01JEXAMPLE0000000000000000" },
  });

/*
 * Stops every request that would leave for a third-party service.
 *
 * Issue #17's last criterion is that the failure boundaries are covered without
 * calling live third-party services. A browser cannot observe which tests a
 * repository contains, so this is how the criterion constrains this file: the
 * guard is installed before anything else, and a request no substitute below
 * answers is refused here rather than allowed out.
 *
 * Refused, not recorded as a failure of the test. A dependency that arrives
 * after this file is locked — the Maps embed Issue #8 owns, for one — is then
 * simply another failing optional dependency, which is exactly the condition
 * these criteria say the core must survive.
 *
 * Playwright consults the most recently registered matching route first, so
 * every substitute installed after this one takes precedence over it.
 * @param page - The page to guard. Call before any other route is installed.
 */
export const refuseLiveThirdPartyRequests = (page: Page) =>
  page.route(isThirdPartyRequest, (route) => route.abort("blockedbyclient"));

/**
 * Page Object for the dependency failures Issue #17 isolates the core from.
 *
 * Every dependency is answered at the network boundary — the Zipnami API, the
 * browser's own connectivity, and the advertising and consent hosts — so
 * nothing about the client's internals is assumed, and nothing reaches a live
 * service.
 * @param page - The Playwright page driving the browser.
 */
export const createDependencyFailurePage = (page: Page) => {
  const queuedAnswers: EndpointAnswer[] = [];
  let randomRequests = 0;
  let offline = false;
  let heldResponses: Promise<void> | undefined;
  let releaseHeld: (() => void) | undefined;

  let advertisingRequests = 0;
  let answeredAdvertisingRequests = 0;
  const heldAdvertisingRoutes: Route[] = [];

  const answerPreflight = (route: Route) =>
    route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,OPTIONS",
        "access-control-allow-headers": "accept,content-type",
      },
    });

  // The last queued answer repeats once the queue is down to it.
  const nextAnswer = () =>
    queuedAnswers.length > 1 ? queuedAnswers.shift() : queuedAnswers.at(0);

  const fulfil = (route: Route, answer: EndpointAnswer | undefined) => {
    switch (answer?.outcome) {
      case "result":
        return route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify(answer.result),
        });
      case "internal-error":
        return route.fulfill({
          status: 500,
          headers: jsonHeaders,
          body: errorEnvelope(
            "INTERNAL_ERROR",
            "An unexpected error occurred.",
          ),
        });
      case "schema-violating-body":
        return route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: schemaViolatingBody,
        });
      case "non-json-body":
        return route.fulfill({
          status: 200,
          headers: {
            ...jsonHeaders,
            "content-type": "text/html; charset=utf-8",
          },
          body: nonJsonBody,
        });
      case "data-unavailable":
      case undefined:
        return route.fulfill({
          status: 503,
          headers: jsonHeaders,
          body: errorEnvelope(
            "DATA_UNAVAILABLE",
            "Postal code data is temporarily unavailable.",
          ),
        });
    }
  };

  const answerRandomRequest = async (route: Route) => {
    // A browser that honours the offline emulation never gets here. One that
    // still lets the request reach the route is answered the way an offline
    // network would answer it, so no browser consumes a queued answer while
    // the visitor is offline.
    if (offline) {
      await route.abort("internetdisconnected");
      return;
    }

    // Counted before the hold so a duplicate activation during a retry is
    // visible while the first request is still in flight.
    randomRequests += 1;

    if (heldResponses) {
      await heldResponses;
    }

    await fulfil(route, nextAnswer());
  };

  /**
   * Installs the API stub. Call before navigating.
   * @param answers - The answers the endpoint gives, in order.
   */
  const stubRandomEndpoint = async (answers: readonly EndpointAnswer[]) => {
    queuedAnswers.length = 0;
    queuedAnswers.push(...answers);
    randomRequests = 0;

    await page.route(randomEndpointPattern, (route) =>
      route.request().method() === "OPTIONS"
        ? answerPreflight(route)
        : answerRandomRequest(route),
    );
  };

  const randomRequestCount = () => randomRequests;

  // Holds every API answer until released: the in-flight state is reached
  // without guessing how long a timer would need to be.
  const holdResponses = () => {
    heldResponses = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
  };

  const releaseResponses = () => {
    releaseHeld?.();
    heldResponses = undefined;
  };

  // The browser's own connectivity, the way a visitor loses it: the page stays
  // loaded, and every request it makes from now on fails before a server sees
  // it.
  const goOffline = async () => {
    offline = true;
    await page.context().setOffline(true);
  };

  const goOnline = async () => {
    offline = false;
    await page.context().setOffline(false);
  };

  /**
   * Leaves every advertising and consent request unanswered until released.
   *
   * A dependency that never answers is the case that would gate rendering if
   * anything waited on it; a refusal would end the wait and hide that.
   * Call before navigating.
   */
  const holdEveryAdvertisingRequest = async () => {
    advertisingRequests = 0;
    answeredAdvertisingRequests = 0;

    await page.route(advertisingRequestPattern, (route) => {
      advertisingRequests += 1;
      heldAdvertisingRoutes.push(route);
    });
  };

  /**
   * Answers the advertising loader with an SDK that throws, and refuses every
   * other advertising and consent request. Call before navigating.
   */
  const serveThrowingAdvertisingSdk = async () => {
    advertisingRequests = 0;
    answeredAdvertisingRequests = 0;

    await page.route(advertisingRequestPattern, (route) => {
      advertisingRequests += 1;

      if (!advertisingScriptPattern.test(route.request().url())) {
        return route.abort("failed");
      }

      answeredAdvertisingRequests += 1;
      return route.fulfill({
        status: 200,
        headers: { "content-type": "text/javascript; charset=utf-8" },
        body: throwingAdvertisingSdk,
      });
    });
  };

  const advertisingRequestCount = () => advertisingRequests;

  const answeredAdvertisingRequestCount = () => answeredAdvertisingRequests;

  // Ends every held advertising request as a failure, so none is left open
  // when the page closes.
  const releaseHeldAdvertisingRequests = async () => {
    const held = heldAdvertisingRoutes.splice(0);
    await Promise.all(held.map((route) => route.abort("failed")));
  };

  /*
   * Waits without anything to wait for.
   *
   * "Does not enter an unbounded loop" is the absence of further requests, and
   * absence has no event to await. Real elapsed time, as the Issue #9
   * acceptance test uses for the same question (ADR-0016).
   * @param milliseconds - How long to let further attempts arrive.
   */
  const letFurtherAttemptsArrive = (milliseconds: number) =>
    page.waitForTimeout(milliseconds);

  return {
    stubRandomEndpoint,
    randomRequestCount,
    holdResponses,
    releaseResponses,
    goOffline,
    goOnline,
    holdEveryAdvertisingRequest,
    serveThrowingAdvertisingSdk,
    advertisingRequestCount,
    answeredAdvertisingRequestCount,
    releaseHeldAdvertisingRequests,
    letFurtherAttemptsArrive,
  };
};

export type DependencyFailurePage = ReturnType<
  typeof createDependencyFailurePage
>;
