import { z } from "zod";

const trimmed = z.string().trim();

export const saveCatalogServiceSchema = z.object({
  serviceId: trimmed.min(1).optional(),
  name: trimmed.min(1, "Name is required").max(120),
  slug: trimmed
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Slug must be lowercase letters, numbers, and underscores")
    .optional(),
  currency: trimmed.min(3).max(3).default("aud"),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  includedUsers: z.number().int().min(0).max(1_000_000),
  includedLocations: z.number().int().min(0).max(1_000_000),
  includedAdmins: z.number().int().min(0).max(1_000_000),
  upfrontCost12Minor: z.number().finite().min(0).optional(),
  features: z.array(trimmed.max(200)).max(40).default([]),
  monthlyCost12Minor: z.number().finite().min(0),
  monthlyCost24Minor: z.number().finite().min(0),
});

export type SaveCatalogServiceInput = z.infer<typeof saveCatalogServiceSchema>;

export const createCatalogServiceSchema = z.object({
  name: trimmed.min(1, "Name is required").max(120),
  slug: trimmed
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Slug must be lowercase letters, numbers, and underscores")
    .optional(),
  currency: trimmed.min(3).max(3).default("aud"),
  monthlyCost12Minor: z.number().finite().min(0),
  monthlyCost24Minor: z.number().finite().min(0),
  syncToStripe: z.boolean().default(false),
});

export type CreateCatalogServiceInput = z.infer<typeof createCatalogServiceSchema>;

export function saveInputToServiceTerms(input: SaveCatalogServiceInput): Array<{
  months: 12 | 24;
  monthlyAmountMinor: number;
}> {
  return [
    { months: 12, monthlyAmountMinor: Math.round(input.monthlyCost12Minor) },
    { months: 24, monthlyAmountMinor: Math.round(input.monthlyCost24Minor) },
  ];
}
