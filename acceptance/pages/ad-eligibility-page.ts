import type { Page } from "@playwright/test";
import { adSlotSelector } from "../selectors/advertising-selectors.ts";
import { createAdvertisingPage } from "./advertising-page.ts";

/** What the page has done towards showing an ad, at one moment. */
export type AdActivity = {
  /** Requests for the AdSense loader script, across every document so far. */
  readonly loaderRequests: number;
  /** Calls to `adsbygoogle.push` in the current document. */
  readonly pushes: number;
};

type PushRecorder = { __zipnamiAdPushes?: number };

/**
 * Page Object for which screens may request an ad (Issue #120).
 *
 * ui-design.md section 7.1 names three ways a screen requests an ad: loading
 * the AdSense loader, rendering an `ins.adsbygoogle` unit, and calling
 * `adsbygoogle.push`. All three are Google's own public placement contract
 * rather than Zipnami's markup, the same kind of dependency the Issue #9
 * acceptance test takes on `ins.adsbygoogle`, so each is observed here at that
 * contract: the loader at the network boundary, the unit in the document, and
 * the push on the queue Google's tag reads.
 *
 * Composes the Issue #9 Page Object rather than editing it: committed files
 * under acceptance/ are locked.
 * @param page - The Playwright page driving the browser.
 */
export const createAdEligibilityPage = (page: Page) => {
  const advertising = createAdvertisingPage(page);

  /*
   * Counts every call to `adsbygoogle.push`, whoever makes it.
   *
   * The queue is `window.adsbygoogle`, which a page creates by assignment and
   * which the real SDK (and the Issue #9 substitute) later give a push of their
   * own. Both assignments are intercepted, so a push is counted whether it
   * lands on the plain array or on the SDK's replacement, and the queue
   * otherwise behaves as it would without this. Call before navigating.
   */
  const recordAdPushes = () =>
    page.addInitScript(() => {
      const recorder = window as unknown as PushRecorder & {
        adsbygoogle?: unknown;
      };
      recorder.__zipnamiAdPushes = 0;

      const countPushes = (queue: unknown) => {
        if (typeof queue !== "object" || queue === null) {
          return queue;
        }

        const target = queue as { push?: (...items: unknown[]) => unknown };
        let push = target.push;

        Object.defineProperty(target, "push", {
          configurable: true,
          get:
            () =>
            (...items: unknown[]) => {
              recorder.__zipnamiAdPushes =
                (recorder.__zipnamiAdPushes ?? 0) + 1;
              return push?.apply(target, items);
            },
          set: (replacement: (...items: unknown[]) => unknown) => {
            push = replacement;
          },
        });

        return queue;
      };

      let current: unknown;
      Object.defineProperty(recorder, "adsbygoogle", {
        configurable: true,
        get: () => current,
        set: (queue: unknown) => {
          current = countPushes(queue);
        },
      });
    });

  /*
   * Answers the AdSense loader with the Issue #9 substitute, which fills any
   * unit it finds. An ad that would really show is the case that matters on a
   * screen without publisher content, so a request is answered rather than
   * refused. Call before navigating.
   */
  const answerAdRequestsWithFilledAds = () =>
    advertising.substituteAdvertisingSdk();

  const adPushCount = () =>
    page.evaluate(
      () => (window as unknown as PushRecorder).__zipnamiAdPushes ?? 0,
    );

  const adActivity = async (): Promise<AdActivity> => ({
    loaderRequests: advertising.advertisingScriptRequestCount(),
    pushes: await adPushCount(),
  });

  /*
   * Every ad unit in the document, not only inside the advertising region: a
   * unit left behind on a screen that has no such region is exactly the stale
   * container Issue #120 forbids.
   */
  const adUnits = () => page.locator(adSlotSelector);

  /*
   * Waits without anything to wait for.
   *
   * "No ad is requested" is an absence, and absence has no event to await.
   * Real elapsed time, as the Issue #9 acceptance test uses for the same kind
   * of question (ADR-0016). Generous rather than tuned.
   * @param milliseconds - How long to let a late request or unit arrive.
   */
  const letLateAdRequestsArrive = (milliseconds: number) =>
    page.waitForTimeout(milliseconds);

  const goBack = () => page.goBack();

  const reload = () => page.reload();

  return {
    recordAdPushes,
    answerAdRequestsWithFilledAds,
    adPushCount,
    adActivity,
    adUnits,
    advertisingRegion: advertising.advertisingRegion,
    letLateAdRequestsArrive,
    goBack,
    reload,
  };
};

export type AdEligibilityPage = ReturnType<typeof createAdEligibilityPage>;
