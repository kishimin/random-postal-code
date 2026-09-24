import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MAX_AD_SCRIPT_LOAD_ATTEMPTS, adScriptRetryDelayMs } from "../config";
import { useAdsenseScript } from "./use-adsense-script";

const SCRIPT_URL =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456";

/**
 * The loader scripts this hook has appended to `document.head` so far, in
 * append order. A script is created fresh per attempt (config.ts's retry
 * schedule), so its count is this test file's stand-in for "how many
 * attempts have happened".
 * @returns {HTMLScriptElement[]} The matching `<script>` elements currently in the document.
 */
const loaderScripts = (): HTMLScriptElement[] =>
  Array.from(
    // This hook manipulates document.head directly and renders no React
    // tree of its own, so there is no render()/screen/container Testing
    // Library query to prefer over the DOM here.
    // eslint-disable-next-line testing-library/no-node-access -- see above
    document.querySelectorAll<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`),
  );

describe("useAdsenseScript", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const script of loaderScripts()) {
      script.remove();
    }
  });

  // config.ts's hasRemainingAdScriptAttempt bounds the schedule at
  // MAX_AD_SCRIPT_LOAD_ATTEMPTS (design.md section 7: "must not ... retry
  // indefinitely"). Removing the error listener that reads it would leave
  // every other test in this feature green, since none of them fail the
  // script MAX_AD_SCRIPT_LOAD_ATTEMPTS times in a row.
  test("stops after exactly MAX_AD_SCRIPT_LOAD_ATTEMPTS failures", () => {
    renderHook(() => useAdsenseScript(SCRIPT_URL));

    Array.from({ length: MAX_AD_SCRIPT_LOAD_ATTEMPTS }).forEach((_, index) => {
      const attemptNumber = index + 1;
      const [script] = loaderScripts();
      expect(loaderScripts()).toHaveLength(1);

      act(() => {
        script.dispatchEvent(new Event("error"));
      });

      if (attemptNumber < MAX_AD_SCRIPT_LOAD_ATTEMPTS) {
        act(() => {
          vi.advanceTimersByTime(adScriptRetryDelayMs(attemptNumber));
        });
      }
    });

    // The budget is spent: no further attempt is scheduled, so even a long
    // wait creates no new script.
    act(() => {
      vi.advanceTimersByTime(100_000);
    });
    expect(loaderScripts()).toHaveLength(0);
  });

  // config.ts's adScriptRetryDelayMs grows with the attempt number so a run
  // of failures backs off instead of hammering the host at a fixed interval.
  // This asserts the hook actually waits that computed delay, not a
  // hardcoded or immediate one.
  test("waits exactly adScriptRetryDelayMs(attemptNumber) before the next attempt", () => {
    renderHook(() => useAdsenseScript(SCRIPT_URL));
    const [firstScript] = loaderScripts();

    act(() => {
      firstScript.dispatchEvent(new Event("error"));
    });

    const delay = adScriptRetryDelayMs(1);

    act(() => {
      vi.advanceTimersByTime(delay - 1);
    });
    expect(loaderScripts()).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(loaderScripts()).toHaveLength(1);
  });

  // A retry timer that was pending when the component unmounted must not
  // fire into a new attempt. clearTimeout on cleanup is what prevents this in
  // the common case.
  test("schedules no further attempt once unmounted while a retry is pending", () => {
    const { unmount } = renderHook(() => useAdsenseScript(SCRIPT_URL));
    const [firstScript] = loaderScripts();

    act(() => {
      firstScript.dispatchEvent(new Event("error"));
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(adScriptRetryDelayMs(1) + 10_000);
    });
    expect(loaderScripts()).toHaveLength(0);
  });

  // Belt-and-suspenders for the same guarantee: the network request behind an
  // in-flight script can still fail after the component removed it from the
  // DOM, because removal does not abort the request. The `cancelled` flag
  // inside the error listener -- not clearTimeout, since no retry was even
  // scheduled yet -- is what has to stop a new attempt from starting here.
  test("ignores a late error event that arrives after unmount", () => {
    const { unmount } = renderHook(() => useAdsenseScript(SCRIPT_URL));
    const [firstScript] = loaderScripts();

    unmount();

    act(() => {
      firstScript.dispatchEvent(new Event("error"));
    });
    act(() => {
      vi.advanceTimersByTime(adScriptRetryDelayMs(1) + 10_000);
    });

    expect(loaderScripts()).toHaveLength(0);
  });

  test("does not retry once the script has loaded successfully", () => {
    renderHook(() => useAdsenseScript(SCRIPT_URL));
    const [firstScript] = loaderScripts();

    act(() => {
      firstScript.dispatchEvent(new Event("load"));
    });

    act(() => {
      vi.advanceTimersByTime(
        adScriptRetryDelayMs(MAX_AD_SCRIPT_LOAD_ATTEMPTS) + 10_000,
      );
    });

    // Still the one script that loaded -- no error-driven retry replaced it.
    expect(loaderScripts()).toHaveLength(1);
    expect(loaderScripts()[0]).toBe(firstScript);
  });

  // A script still in flight (neither loaded nor errored) carries no reason
  // to survive an unmounted component; removing it lets a later mount start
  // clean instead of leaving an orphaned request's listener attached forever.
  test("removes an in-flight script that has neither loaded nor errored when unmounted", () => {
    const { unmount } = renderHook(() => useAdsenseScript(SCRIPT_URL));
    expect(loaderScripts()).toHaveLength(1);

    unmount();

    expect(loaderScripts()).toHaveLength(0);
  });

  // design.md section 7's optional-dependency contract, and P2-D of this
  // feature's own review: a script that already succeeded must not be
  // redownloaded (and its retry budget reset) just because the component
  // remounted -- e.g. navigating from "/" to "/privacy" and back.
  test("keeps a successfully loaded script in place after unmount, instead of forcing a redownload on remount", () => {
    const { unmount } = renderHook(() => useAdsenseScript(SCRIPT_URL));
    const [firstScript] = loaderScripts();

    act(() => {
      firstScript.dispatchEvent(new Event("load"));
    });

    unmount();

    expect(loaderScripts()).toHaveLength(1);
    expect(loaderScripts()[0]).toBe(firstScript);
  });
});
