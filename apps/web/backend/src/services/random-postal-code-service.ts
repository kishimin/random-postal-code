import { postalCodeSchema, type PostalCode } from "@zipnami/shared";
import type { PostalCodeRepository } from "../repositories/postal-code-repository.ts";
import { pickRandomIndex } from "./pick-random-index.ts";

/**
 * The outcome of one selection attempt, one layer below the HTTP status
 * codes api-design.md section 4.2 maps these to. A controller reads this
 * union rather than catching an exception, so every failure a controller
 * must answer is a value it can switch over exhaustively.
 */
export type PostalCodeSelectionResult =
  | { readonly outcome: "ok"; readonly postalCode: PostalCode }
  | { readonly outcome: "dataUnavailable" }
  | { readonly outcome: "internalError" };

// api-design.md section 4.2 maps a missing, unreadable, empty, or invalid
// dataset to 503 DATA_UNAVAILABLE. A repository translates its own missing
// or unreadable artifact into an empty collection (section 5), so checking
// emptiness and per-entry validity here covers all four states regardless of
// which PostalCodeRepository implementation is plugged in.
//
// Re-running this per entry on every request would duplicate the validation
// GeneratedDatasetRepository already did once at module evaluation, and
// costs tens of milliseconds of CPU per request at Issue #34's dataset size
// -- enough to exceed Cloudflare's free-plan CPU limit. Dropping entry-level
// validation here instead would let a repository stub that returns a
// partially-corrupt array (the acceptance test's DATA_UNAVAILABLE-on-corrupt
// case) serve an invalid entry, so the check is memoized by collection
// identity rather than removed: the real repository returns the same
// module-level array reference on every call (api-design.md section 5:
// "loaded once ... and treated as immutable"), so this validates once per
// isolate in practice and every subsequent call is a WeakMap lookup.
const usableCollectionCache = new WeakMap<readonly PostalCode[], boolean>();

const isUsableCollection = (postalCodes: readonly PostalCode[]): boolean => {
  const cached = usableCollectionCache.get(postalCodes);

  if (cached !== undefined) {
    return cached;
  }

  const usable =
    postalCodes.length > 0 &&
    postalCodes.every((entry) => postalCodeSchema.safeParse(entry).success);

  usableCollectionCache.set(postalCodes, usable);

  return usable;
};

/**
 * Selects one postal code uniformly at random from what the repository
 * exposes, or reports why none could be selected.
 *
 * A repository rejection is caught here rather than left to propagate: it is
 * a failure no lower layer translated into an explicit collection state, so
 * it is reported as `internalError` (api-design.md section 4.2's "unexpected
 * application failure") instead of crashing the request. `.catch()` rather
 * than try/catch, so no reassignable local variable is needed to carry the
 * result out of the block.
 */
export const selectRandomPostalCode = async (
  repository: PostalCodeRepository,
): Promise<PostalCodeSelectionResult> => {
  const postalCodes = await repository.listPostalCodes().catch(() => undefined);

  if (postalCodes === undefined) {
    return { outcome: "internalError" };
  }

  if (!isUsableCollection(postalCodes)) {
    return { outcome: "dataUnavailable" };
  }

  const index = pickRandomIndex(postalCodes.length);
  const postalCode = postalCodes[index];

  // `noUncheckedIndexedAccess` is not enabled, so the compiler does not
  // connect this access back to `isUsableCollection`'s `length > 0` guard
  // above. A sparse collection (a hole, which `Array.prototype.every`
  // silently skips) reaches this line with a valid index but an absent
  // entry; guarding explicitly turns that into a classified failure instead
  // of a 200 with `postalCode: undefined`.
  if (postalCode === undefined) {
    return { outcome: "internalError" };
  }

  return { outcome: "ok", postalCode };
};
