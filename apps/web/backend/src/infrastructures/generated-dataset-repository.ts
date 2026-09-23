import { postalCodeSchema, type PostalCode } from "@zipnami/shared";
import { z } from "zod";
import type { PostalCodeRepository } from "../repositories/postal-code-repository.ts";
import rawPostalCodes from "../data/postal-codes.generated.json";

/*
 * The dataset TypeScript infers from the JSON literal is not `PostalCode[]`:
 * `addresses` comes back as a plain array, not the non-empty tuple the
 * shared type requires. `postalCodeSchema` is what actually guards the
 * artifact's shape, as api-design.md section 3 requires and the Issue #4
 * acceptance test's DATA_UNAVAILABLE cases exercise; the compiler checking
 * a hand-written type alongside it would not catch the same corruption.
 *
 * A build-time artifact bundled into the Worker's own module graph, not a
 * runtime read: module evaluation happens once per isolate, so this parses
 * once and stays immutable, with no per-request cost or network dependency
 * (api-design.md section 5).
 *
 * The real Japan Post archive is not retrievable in this repository yet --
 * Issue #34 owns fetching and Shift-JIS-decoding it -- so this file is a
 * small placeholder of real Japan Post postal codes and addresses, produced
 * by running `@zipnami/postal-data`'s own `buildPostalCodeDataset` (the
 * function `bun run --filter @zipnami/postal-data regenerate` calls) over a
 * small KEN_ALL.CSV-shaped input, not hand-typed JSON. Replacing it with the
 * full dataset once Issue #34 lands changes only this file.
 */
/**
 * Validates raw data against the shared `PostalCode` contract, falling back
 * to an empty collection instead of throwing. An artifact that fails to
 * parse is translated this way so every `PostalCodeRepository` failure mode
 * -- missing, unreadable, empty, or invalid -- reaches the application layer
 * as the same explicit "nothing usable" collection state (api-design.md
 * section 5), which `RandomPostalCodeService` already maps to
 * `DATA_UNAVAILABLE`, rather than crashing Worker startup.
 */
export const parseGeneratedPostalCodes = (
  raw: unknown,
): readonly PostalCode[] => {
  const parsed = z.array(postalCodeSchema).safeParse(raw);

  return parsed.success ? parsed.data : [];
};

const postalCodes = parseGeneratedPostalCodes(rawPostalCodes);

/**
 * Reads the postal-code dataset bundled into the Worker's own module graph
 * at build time. Implements the `PostalCodeRepository` port so the
 * application layer never sees the JSON file path or the Worker's module
 * system.
 */
export const generatedDatasetRepository: PostalCodeRepository = {
  listPostalCodes: () => Promise.resolve(postalCodes),
};
