import { z } from "zod";
import { addressSchema } from "./address.schema.ts";

export const postalCodeSchema = z.object({
  postalCode: z.string().regex(/^[0-9]{7}$/),
  // A tuple with a rest element requires at least the leading Address and
  // infers the non-empty `[Address, ...Address[]]` shape from api-design.md
  // section 3, rather than the plain `Address[]` that z.array would infer.
  addresses: z.tuple([addressSchema]).rest(addressSchema),
});

export type PostalCode = z.infer<typeof postalCodeSchema>;
