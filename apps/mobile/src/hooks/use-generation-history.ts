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
 * Where the device's stored history stands. `unreadable` is not `ready`: the
 * stored value may be intact, only unreachable right now.
 */
type StorageStatus = "reading" | "ready" | "unreadable";

/**
 * The generation history, kept on the device (Issue #14). It is read when
 * the screen mounts and written whenever it changes; it never reaches the
 * server and is not shared with the Web client.
 *
 * Nothing is written until the stored history has been read. Otherwise a
 * result made while the read is pending would overwrite what is stored with
 * a history of one, and the read would then find only that. For the same
 * reason nothing is written after a read that failed: the stored history is
 * unknown, so writing would replace it with only this session's results.
 */
export const useGenerationHistory = (): {
  history: readonly PostalCode[];
  loaded: boolean;
  record: (result: PostalCode) => void;
} => {
  const [history, setHistory] = useState<readonly PostalCode[]>([]);
  const [storage, setStorage] = useState<StorageStatus>("reading");

  // The device's storage is an external system the history is kept in step
  // with: read once on mount, then written after each change.
  useEffect(() => {
    const unmounted = new AbortController();
    void AsyncStorage.getItem(HISTORY_STORAGE_KEY)
      .then(
        (raw) => ({ status: "ready" as const, stored: parseStoredHistory(raw) }),
        // A storage that cannot be read does not stop a person from
        // generating; their results stay in memory for this session.
        () => ({ status: "unreadable" as const, stored: [] }),
      )
      .then(({ status, stored }) => {
        if (unmounted.signal.aborted) return;
        setHistory((current) => mergeLoadedHistory(current, stored));
        setStorage(status);
      });
    return () => {
      unmounted.abort();
    };
  }, []);

  useEffect(() => {
    if (storage !== "ready") return;
    // A failed write loses only the convenience of remembering; the history
    // on screen is still right, so the failure is not shown.
    void AsyncStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(history),
    ).catch(() => undefined);
  }, [history, storage]);

  const record = useCallback((result: PostalCode) => {
    setHistory((current) => prependToHistory(current, result));
  }, []);

  return { history, loaded: storage !== "reading", record };
};
