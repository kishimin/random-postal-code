import { z } from "zod";

export const addressSchema = z.object({
  prefecture: z.string(),
  city: z.string(),
  town: z.string(),
});

export type Address = z.infer<typeof addressSchema>;
