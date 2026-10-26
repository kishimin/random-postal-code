import type { PostalCode } from "@zipnami/shared";
import { HISTORY_STORAGE_VERSION } from "./history-storage.schema";
import { parseStoredHistory } from "./parse-stored-history";

/**
 * The localStorage key the Web generation history is persisted under.
 *
 * Versioned in the key itself (rather than relying on the envelope's
 * `version` field alone) so a future incompatible shape can be introduced
 * under a new key without this adapter ever mistaking the old key's value
 * for the new shape.
 */
export const HISTORY_STORAGE_KEY = `zipnami:history:v${HISTORY_STORAGE_VERSION}`;

/**
 * `null` when the browser refuses storage access (site data blocked throws
 * SecurityError on every call), so a refused read looks exactly like nothing
 * having been stored yet.
 */
const tryGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Reads the persisted history, discarding anything that is not valid JSON or
 * does not match the current version's shape instead of letting a read
 * failure propagate (ui-design.md section 5.4).
 */
export const readHistoryEntries = (): readonly PostalCode[] =>
  parseStoredHistory(tryGetItem(HISTORY_STORAGE_KEY));

/**
 * Persists `entries` as the current version's shape.
 *
 * A refused write (site data blocked, or QuotaExceededError on a full origin)
 * is dropped rather than thrown: Issue #7 forbids storage from preventing a
 * new generation, and the in-memory history still shows this page's entries.
 */
export const writeHistoryEntries = (entries: readonly PostalCode[]): void => {
  try {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({ version: HISTORY_STORAGE_VERSION, entries }),
    );
  } catch {
    // Nothing to recover: the history simply lasts as long as the page.
  }
};
