import { postalCodeSchema } from "@zipnami/shared";

/**
 * The 〒NNN-NNNN label for seven digits as the API returns them, or undefined
 * when the value is not a postal code. Validity is the shared contract's, so
 * the app and the API agree on it.
 */
export const formatPostalCode = (postalCode: string): string | undefined => {
  const parsed = postalCodeSchema.shape.postalCode.safeParse(postalCode);
  if (!parsed.success) return undefined;
  return `〒${parsed.data.slice(0, 3)}-${parsed.data.slice(3)}`;
};
