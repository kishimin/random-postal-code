import type { Page, Route } from "@playwright/test";
import type { Address } from "@zipnami/shared";
import {
  externalMapLinkSelector,
  googleMapsRequestPattern,
  mapAddressQuery,
  mapSelectors,
} from "../selectors/map-selectors.ts";
import { createPostalCodeGeneratorPage } from "./postal-code-generator-page.ts";

/**
 * How the stubbed Google Maps embed answers the browser.
 *
 * `unreachable` is the network failure Issue #8 names. `rejected` is the
 * transport-level shape of the key and billing failures it also names: an
 * unauthorized, restricted, or unbilled key is refused before any map is drawn.
 * Google's own error page, when it renders one inside the frame, is cross-origin
 * and therefore invisible to the page and to this test alike.
 */
export type MapEmbedOutcome = "served" | "unreachable" | "rejected";

const servedEmbedBody =
  '<!doctype html><html lang="en"><title>Stubbed map</title><body></body></html>';

const rejectedEmbedBody =
  '<!doctype html><html lang="en"><title>Rejected</title><body></body></html>';

const embedHeaders = {
  "content-type": "text/html; charset=utf-8",
} as const;

/**
 * Page Object for the embedded map and the external map links on the result.
 *
 * Composes the Issue #6 generator Page Object rather than repeating it: the map
 * only exists once a result does, so every map criterion is stated in terms of
 * the postal code and addresses that screen already shows.
 *
 * Google is answered here rather than reached. design.md section 7 makes Maps an
 * optional dependency of the Web experience, and a test that let the requests out
 * would be measuring Google's availability and the key the build happened to
 * carry instead of the behavior Issue #8 describes.
 * @param page - The Playwright page driving the browser.
 */
export const createAddressMapPage = (page: Page) => {
  const generator = createPostalCodeGeneratorPage(page);
  const requestedMapUrls: string[] = [];
  let embedOutcome: MapEmbedOutcome = "served";
  let embedRouteInstalled = false;

  const answerEmbedRequest = async (route: Route) => {
    requestedMapUrls.push(route.request().url());

    if (embedOutcome === "unreachable") {
      await route.abort("failed");
      return;
    }

    if (embedOutcome === "rejected") {
      await route.fulfill({
        status: 403,
        headers: embedHeaders,
        body: rejectedEmbedBody,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: embedHeaders,
      body: servedEmbedBody,
    });
  };

  /**
   * Installs the Google Maps stub. Call before navigating.
   * @param outcome - How every map request is answered for the rest of the test.
   */
  const stubMapEmbed = async (outcome: MapEmbedOutcome) => {
    embedOutcome = outcome;
    requestedMapUrls.length = 0;

    if (embedRouteInstalled) {
      return;
    }

    embedRouteInstalled = true;
    await page.route(googleMapsRequestPattern, answerEmbedRequest);
  };

  /*
   * The addresses the embedded map has been asked to show, oldest first.
   *
   * Read at the network boundary rather than from the frame's markup: what the
   * browser asks Google for is the whole of the embed contract, and it stays
   * the same observation whether the implementation renders one frame and
   * changes its source or replaces the frame on every selection.
   */
  const embeddedAddresses = () => requestedMapUrls.map(mapAddressQuery);

  const currentEmbeddedAddress = () => embeddedAddresses().at(-1) ?? "";

  const mapRequestCount = () => requestedMapUrls.length;

  // The map sits after the result (ui-design.md section 7), so on a short
  // viewport it can start below the fold and a deferred frame would not load.
  // Scrolling toward it is what a visitor does to look at it.
  const revealMap = () => page.mouse.wheel(0, 2000);

  const mapSelectionAction = (address: Address) =>
    generator
      .addressEntry(address)
      .getByRole("button", { name: mapSelectors.selectMapTarget });

  const anyMapSelectionAction = () =>
    page
      .getByRole("main")
      .getByRole("button", { name: mapSelectors.selectMapTarget });

  const selectMapTarget = (address: Address) =>
    mapSelectionAction(address).click();

  const externalMapLink = (address: Address) =>
    generator.addressEntry(address).locator(externalMapLinkSelector);

  /*
   * The `href` values exactly as written, before the browser decodes anything.
   *
   * The criterion asks for an encoded query, and only the raw attribute shows
   * whether encoding happened: a decoded reading cannot tell an escaped address
   * from a literal one.
   */
  const externalMapLinkHrefs = (address: Address) =>
    externalMapLink(address).evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );

  const externalMapAddresses = async (address: Address) =>
    (await externalMapLinkHrefs(address)).map(mapAddressQuery);

  return {
    ...generator,
    stubMapEmbed,
    embeddedAddresses,
    currentEmbeddedAddress,
    mapRequestCount,
    revealMap,
    mapSelectionAction,
    anyMapSelectionAction,
    selectMapTarget,
    externalMapLink,
    externalMapLinkHrefs,
    externalMapAddresses,
  };
};

export type AddressMapPage = ReturnType<typeof createAddressMapPage>;
