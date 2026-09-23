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
 * Reads the persisted history, discarding anything that is not valid JSON or
 * does not match the current version's shape instead of letting a read
 * failure propagate (ui-design.md section 5.4).
 */
export const readHistoryEntries = (): readonly PostalCode[] =>
  parseStoredHistory(localStorage.getItem(HISTORY_STORAGE_KEY));

/** Persists `entries` as the current version's shape. */
export const writeHistoryEntries = (entries: readonly PostalCode[]): void => {
  localStorage.setItem(
    HISTORY_STORAGE_KEY,
    JSON.stringify({ version: HISTORY_STORAGE_VERSION, entries }),
  );
};
