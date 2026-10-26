import type { PostalCode } from "@zipnami/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryEntry } from "../components/HistoryList";
import { prependHistoryEntry } from "../history-state";
import {
  readHistoryEntries,
  writeHistoryEntries,
} from "../storage/history-storage";

export type UseHistoryResult = {
  entries: readonly HistoryEntry[];
  addEntry: (entry: PostalCode) => void;
};

const withId = (entry: PostalCode): HistoryEntry => ({
  ...entry,
  id: crypto.randomUUID(),
});

// Drops the client-only id before persisting: ui-design.md section 5.4 asks
// for the canonical PostalCode and nothing else, and the id exists only to
// give a rendered entry a stable React identity across reorders.
const withoutId = ({ postalCode, addresses }: HistoryEntry): PostalCode => ({
  postalCode,
  addresses,
});

/**
 * Owns the Web generation history (design.md section 6.2, ui-design.md
 * section 5.4): newest first, duplicates retained, capped at the configured
 * limit, and persisted so it survives a reload.
 *
 * Ids are assigned here rather than persisted -- they exist only so each
 * rendered entry keeps its own component identity (and therefore its own
 * expand/collapse state) as new entries are prepended in front of it, not to
 * identify anything server-side.
 */
export const useHistory = (): UseHistoryResult => {
  const [entries, setEntries] = useState<readonly HistoryEntry[]>(() =>
    readHistoryEntries().map(withId),
  );
  const restored = useRef(entries);

  // Persisted after the render that shows the change, not inside the
  // setEntries updater: React requires updaters to be pure and runs them
  // twice under StrictMode. The history just read back is skipped, so a mount
  // never rewrites the storage it only read.
  useEffect(() => {
    if (entries === restored.current) return;
    writeHistoryEntries(entries.map(withoutId));
  }, [entries]);

  const addEntry = useCallback((entry: PostalCode) => {
    // Drawn once per generation, outside the updater for the same reason the
    // write is: a doubled updater would otherwise give one entry two ids.
    const identified = withId(entry);
    setEntries((current) => prependHistoryEntry(current, identified));
  }, []);

  return { entries, addEntry };
};
