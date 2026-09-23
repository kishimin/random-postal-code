import { postalCodeSchema } from "@zipnami/shared";
import { z } from "zod";

/**
 * The persisted history's current shape version.
 *
 * design.md section 12 assigns "Web history keys and migration" to this
 * Issue's own Red/Green cycles rather than fixing it in the design contract,
 * so a later shape change only has to add a schema and a migration step here
 * -- `parseStoredHistory` already discards anything that does not match the
 * current version instead of assuming it is safe to read.
 */
export const HISTORY_STORAGE_VERSION = 1;

/** The versioned envelope the history is persisted under. */
export const historyStorageSchema = z.object({
  version: z.literal(HISTORY_STORAGE_VERSION),
  entries: z.array(postalCodeSchema),
});
