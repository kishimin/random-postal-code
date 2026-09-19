import { z } from "zod";

export const addressSchema = z.object({
  // Fields intentionally accept an empty string. api-design.md section 3
  // requires `addresses` to be non-empty but only requires each field to be
  // a string, not a non-empty one; some legitimate Japan Post records have no
  // town-level component, and rejecting an empty string here would turn a
  // valid record into a false DATA_UNAVAILABLE.
  prefecture: z.string(),
  city: z.string(),
  town: z.string(),
});

export type Address = z.infer<typeof addressSchema>;
