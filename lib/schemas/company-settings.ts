import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .refine((v) => v.length === 0 || z.string().email().safeParse(v).success, {
    message: "Enter a valid email or leave blank",
  });

/** Company settings form — empty strings clear Firestore fields. */
export const updateCompanySettingsSchema = z.object({
  name: z.string().trim().max(200),
  phone: z.string().trim().max(40),
  email: optionalEmail,
  website: z.string().trim().max(2048),
  taxId: z.string().trim().max(64),
  addressLine1: z.string().trim().max(200),
  addressLine2: z.string().trim().max(200),
  city: z.string().trim().max(120),
  region: z.string().trim().max(120),
  postalCode: z.string().trim().max(32),
  country: z.string().trim().max(120),
});

export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;
