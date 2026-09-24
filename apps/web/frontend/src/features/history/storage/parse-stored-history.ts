import type { PostalCode } from "@zipnami/shared";
import { historyStorageSchema } from "./history-storage.schema";

/** `undefined` when `raw` is not valid JSON, so the caller never has to catch. */
const tryParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/**
 * Parses a raw persisted-history value into history entries.
 *
 * Returns an empty history instead of throwing for every way persisted data
 * can be unusable -- absent, not JSON, or JSON of the wrong shape or an
 * unsupported version -- so a visitor whose browser holds none of that never
 * has generation blocked by it (ui-design.md section 5.4).
 */
export const parseStoredHistory = (
  raw: string | null,
): readonly PostalCode[] => {
  if (raw === null) return [];

  const result = historyStorageSchema.safeParse(tryParseJson(raw));
  return result.success ? result.data.entries : [];
};
