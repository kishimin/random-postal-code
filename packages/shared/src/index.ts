/*
 * Canonical contracts shared by the Web client and the API.
 *
 * api-design.md section 3 requires this package to stay free of React, React
 * Native, Hono, and Cloudflare dependencies, so both sides can import the same
 * schemas without inheriting the other side's runtime.
 *
 * zod is the runtime-schema library: types are inferred from the schemas
 * (z.infer) rather than declared by hand beside them, so a consumer cannot
 * drift into an incompatible handwritten copy of a contract.
 */

export { addressSchema, type Address } from "./schemas/address.schema.ts";
export {
  postalCodeSchema,
  type PostalCode,
} from "./schemas/postal-code.schema.ts";
