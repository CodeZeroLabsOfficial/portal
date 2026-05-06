import { z } from "zod";

/** Profile form — empty strings are persisted so fields can be cleared in Firestore. */
export const updateUserProfileSchema = z.object({
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  phone: z.string().trim().max(40),
  website: z.string().trim().max(2048),
  dateOfBirth: z
    .string()
    .trim()
    .refine((v) => v.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Use a valid date (YYYY-MM-DD)",
    }),
  addressLine1: z.string().trim().max(200),
  addressLine2: z.string().trim().max(200),
  city: z.string().trim().max(120),
  region: z.string().trim().max(120),
  postalCode: z.string().trim().max(32),
  country: z.string().trim().max(120),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
