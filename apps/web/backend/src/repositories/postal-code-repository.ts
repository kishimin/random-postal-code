import type { PostalCode } from "@zipnami/shared";

/**
 * The application layer's only view of where postal codes come from.
 *
 * api-design.md section 5 draws `PostalCodeRepository` as a port distinct
 * from `GeneratedDatasetRepository`, the infrastructure that implements it:
 * one method returning the normalized collection, with no file path, Worker
 * binding, or other infrastructure detail crossing this boundary. A test
 * substitutes this with a stub that returns a fixed collection or rejects,
 * without reaching into the real implementation's module state.
 */
export type PostalCodeRepository = {
  listPostalCodes: () => Promise<readonly PostalCode[]>;
  /**
   * True when every entry `listPostalCodes` returns has already passed the
   * shared `postalCodeSchema`. Validating the full dataset again on a
   * request costs far more than the Workers Free plan's per-request CPU
   * limit (Issue #88). Absent means unknown, and the application layer
   * validates the entries itself.
   */
  readonly entriesValidated?: true;
};
