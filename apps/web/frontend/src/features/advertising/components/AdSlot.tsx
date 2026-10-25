import { useEffect, useRef } from "react";

type AdSlotProps = {
  clientId: string;
  slotId: string;
  testMode: boolean;
};

type AdsenseWindow = Window & {
  adsbygoogle?: unknown[];
};

/**
 * One AdSense display unit (ui-design.md section 5.2: "AdSense slot and
 * consent boundary"; acceptance/selectors/advertising-selectors.ts's
 * adSlotSelector and testAdSlotSelector locate it by `ins.adsbygoogle` and
 * `data-adtest="on"`, AdSense's own placement contract).
 *
 * An unfilled or never-loaded unit has no explicit height, so it collapses to
 * nothing rather than reserving a visible empty box (ui-design.md section 7:
 * "collapses safely ... according to the SDK contract"). The AdSense loader
 * script -- and its own MutationObserver-driven fill -- is a sibling concern
 * this component does not wait on; see use-adsense-script.ts.
 */
export const AdSlot = ({ clientId, slotId, testMode }: AdSlotProps) => {
  const requested = useRef(false);

  useEffect(() => {
    // Requests this slot's ad exactly once per mount, independent of whether
    // the loader script has arrived yet: the real SDK replaces this queue and
    // processes whatever was already pushed to it (adsbygoogle's own
    // documented contract), so this is safe to call before, during, or
    // instead of a successful load.
    if (requested.current) return;
    requested.current = true;

    try {
      // Once the real SDK has taken over this queue, push() runs its
      // synchronous fill logic immediately and can throw -- for example when
      // a route revisited remounts this component onto an `<ins>` the SDK
      // already filled, or when the slot has no available width to size
      // against. An effect that lets that escape crashes the whole component
      // tree at the nearest error boundary, so it is caught here the same way
      // every other failure in this feature is: silently, never propagated.
      const queue = ((window as AdsenseWindow).adsbygoogle ??= []);
      queue.push({});
    } catch {
      // Intentionally empty: see the comment above.
    }
  }, []);

  return (
    <ins
      className={"adsbygoogle"}
      style={{ display: "block" }}
      data-testid={"advertising-ad-slot"}
      data-ad-client={clientId}
      data-ad-slot={slotId}
      data-ad-format={"auto"}
      data-full-width-responsive={"true"}
      data-adtest={testMode ? "on" : undefined}
    />
  );
};
