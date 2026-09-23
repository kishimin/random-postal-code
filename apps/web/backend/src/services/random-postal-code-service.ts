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
const isUsableCollection = (
  postalCodes: readonly PostalCode[],
): boolean =>
  postalCodes.length > 0 &&
  postalCodes.every((entry) => postalCodeSchema.safeParse(entry).success);

/**
 * Selects one postal code uniformly at random from what the repository
 * exposes, or reports why none could be selected.
 *
 * A repository rejection is caught here rather than left to propagate: it is
 * a failure no lower layer translated into an explicit collection state, so
 * it is reported as `internalError` (api-design.md section 4.2's "unexpected
 * application failure") instead of crashing the request.
 */
export const selectRandomPostalCode = async (
  repository: PostalCodeRepository,
): Promise<PostalCodeSelectionResult> => {
  let postalCodes: readonly PostalCode[];

  try {
    postalCodes = await repository.listPostalCodes();
  } catch {
    return { outcome: "internalError" };
  }

  if (!isUsableCollection(postalCodes)) {
    return { outcome: "dataUnavailable" };
  }

  const index = pickRandomIndex(postalCodes.length);

  return { outcome: "ok", postalCode: postalCodes[index] };
};
