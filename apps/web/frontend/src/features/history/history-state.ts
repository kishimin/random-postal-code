/**
 * Default retention limit for the Web generation history (design.md section
 * 6.2: "a maximum of 20 entries").
 */
export const HISTORY_LIMIT = 20;

/**
 * Prepends `entry` to `entries` and caps the result at `limit`, discarding
 * from the end.
 *
 * Generic over `T` rather than fixed to a domain type: the caller decides
 * what an entry looks like (a bare `PostalCode` in tests, one carrying a
 * client-assigned id in `useHistory`), and prepend-then-cap does not need to
 * know which. Duplicates are never deduplicated -- design.md section 6.2
 * keeps repeated postal codes as separate chronological entries.
 */
export const prependHistoryEntry = <T>(
  entries: readonly T[],
  entry: T,
  limit: number = HISTORY_LIMIT,
): readonly T[] => [entry, ...entries].slice(0, limit);
