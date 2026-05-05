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
