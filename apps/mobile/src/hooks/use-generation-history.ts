import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PostalCode } from "@zipnami/shared";
import { useCallback, useEffect, useState } from "react";
import {
  HISTORY_STORAGE_KEY,
  mergeLoadedHistory,
  parseStoredHistory,
  prependToHistory,
} from "../lib/generation-history";

/**
 * The generation history, kept on the device (Issue #14). It is read when
 * the screen mounts and written whenever it changes; it never reaches the
 * server and is not shared with the Web client.
 *
 * Nothing is written until the stored history has been read. Otherwise a
 * result made while the read is pending would overwrite what is stored with
 * a history of one, and the read would then find only that.
 */
export const useGenerationHistory = (): {
  history: readonly PostalCode[];
  loaded: boolean;
  record: (result: PostalCode) => void;
} => {
  const [history, setHistory] = useState<readonly PostalCode[]>([]);
  const [loaded, setLoaded] = useState(false);

  // The device's storage is an external system the history is kept in step
  // with: read once on mount, then written after each change.
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(HISTORY_STORAGE_KEY).then(
      parseStoredHistory,
      // A storage that cannot be read is an empty history, not a reason to
      // stop a person from generating.
      () => [],
    ).then((stored) => {
      if (cancelled) return;
      setHistory((current) => mergeLoadedHistory(current, stored));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // A failed write loses only the convenience of remembering; the history
    // on screen is still right, so the failure is not shown.
    void AsyncStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(history),
    ).catch(() => undefined);
  }, [history, loaded]);

  const record = useCallback((result: PostalCode) => {
    setHistory((current) => prependToHistory(current, result));
  }, []);

  return { history, loaded, record };
};
