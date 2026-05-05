import { z } from "zod";

const trimmed = z.string().trim();
const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

/** Empty string → undefined; otherwise must be a valid email. */
const optionalCompanyEmail = z
  .string()
  .trim()
  .max(320)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || z.string().email().safeParse(v).success, {
    message: "Enter a valid company email or leave blank",
  });

export const customFieldPairSchema = z.object({
  key: trimmed.min(1, "Key is required").max(64),
  value: z.string().max(2000).default(""),
});

export const createCustomerSchema = z.object({
  name: trimmed.min(1, "Name is required").max(200),
  email: trimmed.email("Valid email required").max(320),
  company: optionalTrimmed,
  companyPhone: optionalTrimmed,
  companyEmail: optionalCompanyEmail,
  companyWebsite: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || v.length <= 2048, {
      message: "Website must be at most 2048 characters",
    }),
  companyAddressLine1: optionalTrimmed,
  companyAddressLine2: optionalTrimmed,
  companyCity: optionalTrimmed,
  companyRegion: optionalTrimmed,
  companyPostalCode: optionalTrimmed,
  companyCountry: optionalTrimmed,
  phone: optionalTrimmed,
  addressLine1: optionalTrimmed,
  addressLine2: optionalTrimmed,
  city: optionalTrimmed,
  region: optionalTrimmed,
  postalCode: optionalTrimmed,
  country: optionalTrimmed,
  tags: z.array(trimmed.max(48)).max(20).default([]),
  customFields: z.array(customFieldPairSchema).max(15).default([]),
  /** When true, sets `portalUserId` if a Firebase Auth user exists for `email`. */
  linkAuthByEmail: z.boolean().default(false),
  /** When true, stores `crmType: "lead"` until converted to a contact. */
  saveAsLead: z.boolean().default(false),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/** Full profile replace for staff edit form (excludes lead toggle — use convert flow). */
export const updateCustomerFormSchema = createCustomerSchema.omit({ saveAsLead: true }).extend({
  id: z.string().min(1),
});

export type UpdateCustomerFormInput = z.infer<typeof updateCustomerFormSchema>;

export const addCustomerNoteSchema = z.object({
  customerId: z.string().min(1),
  body: trimmed.min(1, "Note cannot be empty").max(8000),
  kind: z.enum(["note", "call", "email"]).default("note"),
});

export type AddCustomerNoteInput = z.infer<typeof addCustomerNoteSchema>;
