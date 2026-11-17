import type { Address } from "@zipnami/shared";
import { openURL } from "expo-linking";
import { useCallback, useRef, useState } from "react";
import { buildExternalMapHref } from "../lib/map-url";

/**
 * Opens an address in the device's own map (Issue #14) and remembers whether
 * the last attempt failed. The app embeds no map and asks for no location
 * permission: the operating system picks the handler.
 *
 * `canOpenURL` is not asked first. On Android 11 and later it answers false
 * for https links unless the manifest declares the intent in `<queries>`,
 * which would turn a working device into a failure. Trying and catching
 * is the check that cannot be wrong.
 *
 * `failureCount` rises with every failure, so a second failure while the
 * first is still shown is a change a screen can announce; `failed` alone
 * would stay true and say nothing new.
 */
export const useExternalMap = (): {
  failed: boolean;
  failureCount: number;
  open: (address: Address) => Promise<void>;
  dismiss: () => void;
} => {
  const [failed, setFailed] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  // Opening can overlap: only the latest request may settle the state, or a
  // slow earlier one would overwrite what the person last asked for.
  const latestRequest = useRef(0);

  const open = useCallback(async (address: Address) => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    try {
      await openURL(buildExternalMapHref(address));
      if (request === latestRequest.current) setFailed(false);
    } catch {
      if (request === latestRequest.current) {
        setFailed(true);
        setFailureCount((count) => count + 1);
      }
    }
  }, []);

  const dismiss = useCallback(() => {
    // A request still in flight belongs to what was dismissed.
    latestRequest.current += 1;
    setFailed(false);
  }, []);

  return { failed, failureCount, open, dismiss };
};
