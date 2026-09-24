import type { Address } from "@zipnami/shared";
import { useEffect, useRef, useState } from "react";
import { buildEmbedSrc } from "../lib/map-url";
import { mapsText } from "../site-text";
import { MapFallback } from "./MapFallback";

type AddressMapProps = {
  address: Address;
  /**
   * The Web Maps API key (design.md section 7). An empty key is treated the
   * same as any other map failure, rather than attempted.
   */
  apiKey: string;
};

// A network-level failure (design.md section 7's "network failures" and
// acceptance/pages/address-map-page.ts's "unreachable" outcome) does not
// reliably fire the iframe's own error event across browsers: the
// navigation simply never completes. A load that has not fired after this
// generous timeout is treated as failed instead of waiting indefinitely.
// Exported so the test that exercises it advances the same duration rather
// than a value that could silently drift from this one.
export const MAP_LOAD_TIMEOUT_MS = 8000;

/**
 * The embedded map for the selected address (ui-design.md section 7).
 *
 * The frame is not mounted until its region scrolls into view: it sits below
 * the current result, so mounting it immediately would load an iframe most
 * visits never scroll to. `acceptance/pages/address-map-page.ts`'s
 * `revealMap()` scrolls for exactly this reason.
 *
 * A missing key, a load that never completes, and a load that does complete
 * with a not-yet-errored iframe (an HTTP error response can still finish
 * loading its own document -- the AT's own comment on why "rejected" is
 * unobservable) are the only failure shapes this component can act on. Every
 * one of them falls through to the same `MapFallback`: design.md section 7
 * treats every Maps failure mode the same way -- the result stays usable
 * regardless of which one occurred.
 */
export const AddressMap = ({ address, apiKey }: AddressMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  // A newly selected address deserves a fresh load attempt rather than
  // inheriting the previous address's failure. Adjusted during render
  // (React's own pattern for resetting state when a prop changes) instead of
  // an effect, so the timeout effect below only ever sets `hasFailed` to
  // true -- the one state change that really is synchronizing with an
  // external system, the browser's own timer.
  const [trackedAddress, setTrackedAddress] = useState(address);
  if (trackedAddress !== address) {
    setTrackedAddress(address);
    setHasFailed(false);
  }

  useEffect(() => {
    const node = containerRef.current;
    if (!node || isVisible) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsVisible(true);
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    hasLoadedRef.current = false;

    const timer = setTimeout(() => {
      if (!hasLoadedRef.current) setHasFailed(true);
    }, MAP_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isVisible, address]);

  if (!apiKey || hasFailed) {
    return <MapFallback address={address} />;
  }

  return (
    <div ref={containerRef}>
      {isVisible && (
        <iframe
          title={mapsText.embedTitle(address)}
          src={buildEmbedSrc(address, apiKey)}
          onLoad={() => {
            hasLoadedRef.current = true;
          }}
        />
      )}
    </div>
  );
};
