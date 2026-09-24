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
    } = { cancelled: false, retryTimeoutId: undefined, currentScript: undefined };

    const attemptLoad = (attemptNumber: number) => {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.crossOrigin = "anonymous";

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

    attemptLoad(1);

    return () => {
      load.cancelled = true;
      clearTimeout(load.retryTimeoutId);
      load.currentScript?.remove();
    };
  }, [scriptUrl]);
};
