import type { Locator, Page } from "@playwright/test";
import {
  adSlotSelector,
  advertisingRequestPattern,
  advertisingScriptPattern,
  advertisingSdkSubstitute,
  advertisingSelectors,
  testAdSlotSelector,
} from "../selectors/advertising-selectors.ts";

/** A rectangle in document space, so two of them compare across scroll. */
export type DocumentRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Whether two document-space rectangles share any area.
 *
 * Strict comparisons on every edge, so rectangles that merely touch, and
 * rectangles with no area, do not count as overlapping. Neither is an
 * advertisement covering anything.
 * @param first - One rectangle.
 * @param second - The other rectangle.
 */
export const rectanglesOverlap = (
  first: DocumentRect,
  second: DocumentRect,
): boolean =>
  first.x < second.x + second.width &&
  second.x < first.x + first.width &&
  first.y < second.y + second.height &&
  second.y < first.y + first.height;

/**
 * Page Object for the advertising and consent boundary on the generator route.
 *
 * Nothing here lets a request reach Google. Issue #9's last criterion asks that
 * automated tests cover application-owned states without relying on live ad
 * delivery, so every advertising and consent host is answered at the network
 * boundary — either by a substitute that reproduces the one effect the layout
 * criteria depend on, or by a failure. What the SDK would have fetched from
 * Google is never part of what this test holds.
 * @param page - The Playwright page driving the browser.
 */
export const createAdvertisingPage = (page: Page) => {
  let scriptRequests = 0;
  let advertisingRequests = 0;

  const countRequest = (url: string) => {
    advertisingRequests += 1;

    if (advertisingScriptPattern.test(url)) {
      scriptRequests += 1;
    }
  };

  /*
   * Answers the AdSense loader with the substitute and refuses everything else.
   *
   * One handler decides both cases rather than two handlers whose precedence
   * would depend on the order they were registered in. Call before navigating.
   */
  const substituteAdvertisingSdk = async () => {
    scriptRequests = 0;
    advertisingRequests = 0;

    await page.route(advertisingRequestPattern, (route) => {
      const url = route.request().url();
      countRequest(url);

      if (!advertisingScriptPattern.test(url)) {
        return route.abort("failed");
      }

      return route.fulfill({
        status: 200,
        headers: { "content-type": "text/javascript; charset=utf-8" },
        body: advertisingSdkSubstitute,
      });
    });
  };

  /**
   * Fails every advertising and consent request the page makes.
   *
   * This is the failure the Issue names: a blocked tag, an unreachable consent
   * service, an ad that never arrives. Call before navigating.
   */
  const failEveryAdvertisingRequest = async () => {
    scriptRequests = 0;
    advertisingRequests = 0;

    await page.route(advertisingRequestPattern, (route) => {
      countRequest(route.request().url());
      return route.abort("failed");
    });
  };

  const advertisingScriptRequestCount = () => scriptRequests;

  const advertisingRequestCount = () => advertisingRequests;

  /*
   * Waits without anything to wait for.
   *
   * "Not retried indefinitely" is the absence of further requests, and absence
   * has no event to await. The repository already prefers real elapsed time
   * over a mocked clock for relative timing (ADR-0016), and a mocked clock
   * would in any case answer a different question: whether the schedule is
   * bounded, not whether the application stops asking.
   * @param milliseconds - How long to let further attempts arrive.
   */
  const letFurtherAttemptsArrive = (milliseconds: number) =>
    page.waitForTimeout(milliseconds);

  /*
   * The advertising region.
   *
   * ui-design.md section 7 calls it "a dedicated region labeled as
   * advertising", so it is located as a region carrying that label. Accessible
   * semantics are what an acceptance test may depend on; the markup and styling
   * that produce them are not (ADR-0012).
   */
  const advertisingRegion = () =>
    page.getByRole("region", { name: advertisingSelectors.regionLabel });

  const adSlot = () => advertisingRegion().locator(adSlotSelector);

  const testConfiguredAdSlot = () =>
    advertisingRegion().locator(testAdSlotSelector);

  /**
   * An action of the application's own that sits inside the advertising region.
   *
   * Resolves to nothing when the region holds no such control, which is the
   * state the Issue asks for.
   * @param name - The accessible name of the application action to look for.
   */
  const applicationActionInsideAdvertisingRegion = (name: RegExp) =>
    advertisingRegion()
      .getByRole("button", { name })
      .or(advertisingRegion().getByRole("link", { name }));

  /** Every control a visitor can activate inside the advertising region. */
  const interactiveControlsInsideAdvertisingRegion = () =>
    advertisingRegion()
      .getByRole("button")
      .or(advertisingRegion().getByRole("link"));

  /**
   * Where an element sits in the document, independent of the current scroll.
   *
   * Playwright reports a bounding box relative to the viewport, so two boxes
   * read at different scroll positions cannot be compared. Adding the scroll
   * offset puts every rectangle in one frame, and measuring this way needs no
   * scrolling at all — which also keeps the test off `mouse.wheel`, unsupported
   * in mobile WebKit.
   * @param locator - The element to measure. Must resolve to exactly one.
   */
  const documentRectOf = async (locator: Locator): Promise<DocumentRect> => {
    await locator.waitFor({ state: "visible" });

    return locator.evaluate((element) => {
      const { left, top, width, height } = element.getBoundingClientRect();

      return {
        x: left + window.scrollX,
        y: top + window.scrollY,
        width,
        height,
      };
    });
  };

  /**
   * Where every element a locator resolves to sits in the document.
   * @param locator - The elements to measure.
   */
  const documentRectsOf = async (
    locator: Locator,
  ): Promise<readonly DocumentRect[]> => {
    const elements = await locator.all();

    return Promise.all(elements.map((element) => documentRectOf(element)));
  };

  return {
    substituteAdvertisingSdk,
    failEveryAdvertisingRequest,
    advertisingScriptRequestCount,
    advertisingRequestCount,
    letFurtherAttemptsArrive,
    advertisingRegion,
    adSlot,
    testConfiguredAdSlot,
    applicationActionInsideAdvertisingRegion,
    interactiveControlsInsideAdvertisingRegion,
    documentRectOf,
    documentRectsOf,
  };
};

export type AdvertisingPage = ReturnType<typeof createAdvertisingPage>;
