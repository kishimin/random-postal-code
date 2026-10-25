import { useEffect } from "react";
import { adScriptRetryDelayMs, hasRemainingAdScriptAttempt } from "../config";

/**
 * Loads the AdSense loader script at `scriptUrl`, retrying a failed request
 * with config.ts's bounded backoff schedule (design.md section 7: "Ads must
 * not ... retry indefinitely").
 *
 * Every outcome here is silent by design: a failure is never thrown into the
 * component tree above it (ui-design.md section 7: a failed ad "never
 * displays an application error"), and consent/ad-loading failure must not
 * block core generation, reading, or copying (design.md section 7,
 * Issue #9's own criterion).
 */
export const useAdsenseScript = (scriptUrl: string): void => {
  useEffect(() => {
    // One mutable object instead of several `let` bindings: this project's
    // lint config bans `let` outright (prefer reducers/refs for state that
    // changes), and this effect's cleanup needs to reach back into whichever
    // attempt is still outstanding when the component unmounts.
    const load: {
      cancelled: boolean;
      retryTimeoutId: ReturnType<typeof setTimeout> | undefined;
      currentScript: HTMLScriptElement | undefined;
      succeeded: boolean;
    } = {
      cancelled: false,
      retryTimeoutId: undefined,
      currentScript: undefined,
      succeeded: false,
    };

    const attemptLoad = (attemptNumber: number) => {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.crossOrigin = "anonymous";

      // Cleanup below only knows whether to remove `currentScript` by reading
      // this flag; without it, a remount (e.g. navigating away and back) has
      // no way to tell a script that already loaded from one still in
      // flight, and removes both alike.
      script.addEventListener("load", () => {
        load.succeeded = true;
      });

      script.addEventListener("error", () => {
        script.remove();
        if (load.cancelled || !hasRemainingAdScriptAttempt(attemptNumber)) {
          return;
        }

        load.retryTimeoutId = setTimeout(
          () => attemptLoad(attemptNumber + 1),
          adScriptRetryDelayMs(attemptNumber),
        );
      });

      load.currentScript = script;
      document.head.appendChild(script);
    };

    // A remount (e.g. navigating away and back) runs this effect again with
    // the same scriptUrl. Per the cleanup below, a script it finds already
    // sitting in document.head can only be one that already succeeded -- an
    // in-flight or failed one is always removed by the previous mount's own
    // cleanup -- so it is reused as-is instead of starting a fresh attempt(1)
    // that would redownload AdSense and reset the bounded retry budget.
    const existingScript = document.head.querySelector<HTMLScriptElement>(
      `script[src="${scriptUrl}"]`,
    );

    if (existingScript) {
      load.currentScript = existingScript;
      load.succeeded = true;
    } else {
      attemptLoad(1);
    }

    return () => {
      load.cancelled = true;
      clearTimeout(load.retryTimeoutId);

      // A script that already loaded is left in the document: removing it
      // here would force AdSense to be redownloaded on every remount (e.g.
      // navigating to /privacy and back to /), resetting the bounded retry
      // budget above along with it. A script still in flight has no such
      // reason to survive an unmounted component, so it is still removed.
      if (!load.succeeded) {
        load.currentScript?.remove();
      }
    };
  }, [scriptUrl]);
};
