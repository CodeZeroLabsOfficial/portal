import { z } from "zod";

const bcp47ish = z
  .string()
  .trim()
  .max(35)
  .refine(
    (v) => v.length === 0 || /^[A-Za-z]{2,3}(-[A-Za-z0-9]+)*$/.test(v),
    { message: "Use a valid language tag (e.g. en-AU)" },
  );

export const updateLocalityPreferencesSchema = z.object({
  timeZone: z.string().trim().max(120),
  languageTag: bcp47ish,
  dateFormatPreset: z.enum(["locale", "iso", "dmy", "mdy", "long", ""]),
  timeFormatPreset: z.enum(["12", "24", ""]),
  localeRegionCode: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((v) => v.length === 0 || /^[A-Z]{2}$/.test(v), { message: "Use a two-letter country code" }),
  currencyCode: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((v) => v.length === 0 || /^[A-Z]{3}$/.test(v), { message: "Use a three-letter currency code" }),
});

export type UpdateLocalityPreferencesInput = z.infer<typeof updateLocalityPreferencesSchema>;
