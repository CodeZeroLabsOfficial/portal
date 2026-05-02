import { z } from "zod";

const trimmed = z.string().trim();
const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const customFieldPairSchema = z.object({
  key: trimmed.min(1, "Key is required").max(64),
  value: z.string().max(2000).default(""),
});

export const createCustomerSchema = z.object({
  name: trimmed.min(1, "Name is required").max(200),
  email: trimmed.email("Valid email required").max(320),
  company: optionalTrimmed,
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
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const addCustomerNoteSchema = z.object({
  customerId: z.string().min(1),
  body: trimmed.min(1, "Note cannot be empty").max(8000),
  kind: z.enum(["note", "call", "email"]).default("note"),
});

export type AddCustomerNoteInput = z.infer<typeof addCustomerNoteSchema>;
