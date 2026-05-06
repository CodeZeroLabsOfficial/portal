import { z } from "zod";
import {
  companyWebsiteField,
  optionalCompanyEmail,
  optionalTrimmed,
} from "@/lib/schemas/customer";

const trimmed = z.string().trim();

/** Updates company fields on every customer that shares this account (matched by account key). */
export const updateAccountFormSchema = z.object({
  accountKey: z.string().min(1),
  company: trimmed.min(1, "Company name is required").max(200),
  companyPhone: optionalTrimmed,
  companyEmail: optionalCompanyEmail,
  companyWebsite: companyWebsiteField,
  companyAddressLine1: optionalTrimmed,
  companyAddressLine2: optionalTrimmed,
  companyCity: optionalTrimmed,
  companyRegion: optionalTrimmed,
  companyPostalCode: optionalTrimmed,
  companyCountry: optionalTrimmed,
});

export type UpdateAccountFormInput = z.infer<typeof updateAccountFormSchema>;

/**
 * Creates an account stub (a customer document with `accountOnly: true`) that surfaces only
 * on the Accounts directory. Contact details can be added later by creating customers and
 * setting the same company name.
 */
export const createAccountFormSchema = z.object({
  company: trimmed.min(1, "Company name is required").max(200),
  companyPhone: optionalTrimmed,
  companyEmail: optionalCompanyEmail,
  companyWebsite: companyWebsiteField,
  companyAddressLine1: optionalTrimmed,
  companyAddressLine2: optionalTrimmed,
  companyCity: optionalTrimmed,
  companyRegion: optionalTrimmed,
  companyPostalCode: optionalTrimmed,
  companyCountry: optionalTrimmed,
});

export type CreateAccountFormInput = z.infer<typeof createAccountFormSchema>;
