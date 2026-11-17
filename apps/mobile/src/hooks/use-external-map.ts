import type { Address } from "@zipnami/shared";
import { openURL } from "expo-linking";
import { useCallback, useState } from "react";
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
 */
export const useExternalMap = (): {
  failed: boolean;
  open: (address: Address) => Promise<void>;
  dismiss: () => void;
} => {
  const [failed, setFailed] = useState(false);

  const open = useCallback(async (address: Address) => {
    try {
      await openURL(buildExternalMapHref(address));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setFailed(false);
  }, []);

  return { failed, open, dismiss };
};
