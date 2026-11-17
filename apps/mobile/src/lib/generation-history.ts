import { postalCodeSchema, type PostalCode } from "@zipnami/shared";

/** How many results the history keeps (Issue #14). */
export const HISTORY_LIMIT = 20;

/**
 * The key the whole history is stored under, as one JSON array. The suffix
 * is the format's version, so a future format reads a new key instead of
 * misreading this one.
 */
export const HISTORY_STORAGE_KEY = "zipnami.generation-history.v1";

/**
 * The history with a new result at the beginning. A repeated postal code is
 * a separate entry: the history is a chronology, not a set.
 * @param {readonly PostalCode[]} history - The history, newest first.
 * @param {PostalCode} result - The result to add.
 */
export const prependToHistory = (
  history: readonly PostalCode[],
  result: PostalCode,
): PostalCode[] => [result, ...history].slice(0, HISTORY_LIMIT);

/**
 * The history once the stored one has been read. Results made while the
 * read was pending are newer than anything stored, so they come first.
 * @param {readonly PostalCode[]} current - Results made since the app opened.
 * @param {readonly PostalCode[]} stored - The history read from the device.
 */
export const mergeLoadedHistory = (
  current: readonly PostalCode[],
  stored: readonly PostalCode[],
): PostalCode[] => [...current, ...stored].slice(0, HISTORY_LIMIT);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * The history a stored value holds, or an empty one when there is none or it
 * cannot be trusted. Anything the shared contract rejects discards the whole
 * value: a half-valid history would show entries nobody can explain, and
 * reading must never stop a person from generating.
 * @param {string | null} stored - What the device returned for the key.
 */
export const parseStoredHistory = (stored: string | null): PostalCode[] => {
  if (stored === null) return [];
  const value = parseJson(stored);
  if (!Array.isArray(value)) return [];

  const history: PostalCode[] = [];
  for (const entry of value as unknown[]) {
    const parsed = postalCodeSchema.safeParse(entry);
    if (!parsed.success) return [];
    history.push(parsed.data);
  }
  return history.slice(0, HISTORY_LIMIT);
};
