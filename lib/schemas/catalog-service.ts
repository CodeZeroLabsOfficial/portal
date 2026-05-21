import { z } from "zod";
import {
  applyCatalogServiceTermLookupKeys,
  normalizeLookupKeyBase,
  slugifyCatalogServiceName,
} from "@/lib/catalog-service-slug";
import type { CatalogServiceRecord, CatalogServiceTerm } from "@/types/catalog-service";

const trimmed = z.string().trim();
const lookupKeyBaseField = trimmed
  .min(1, "Lookup key is required")
  .max(40)
  .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only");

const STRIPE_MIN_MINOR = 50;

export const saveCatalogServiceSchema = z.object({
  serviceId: trimmed.min(1).optional(),
  name: trimmed.min(1, "Name is required").max(120),
  description: trimmed.max(500).optional(),
  slug: trimmed
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Slug must be lowercase letters, numbers, and underscores")
    .optional(),
  currency: trimmed.min(3).max(3).default("aud"),
  includedUsers: z.number().int().min(0).max(1_000_000),
  includedLocations: z.number().int().min(0).max(1_000_000),
  includedAdmins: z.number().int().min(0).max(1_000_000),
  upfrontCost12Minor: z.number().finite().min(0).optional(),
  features: z.array(trimmed.max(200)).max(40).default([]),
  monthlyCost12Minor: z.number().finite().min(0),
  monthlyCost24Minor: z.number().finite().min(0),
});

export type SaveCatalogServiceInput = z.infer<typeof saveCatalogServiceSchema>;

export const createCatalogServiceSchema = z
  .object({
    serviceType: z.enum(["plan", "addon"]),
    name: trimmed.min(1, "Name is required").max(120),
    description: trimmed.max(500).optional(),
    billingType: z.enum(["recurring", "one_off"]),
    pricingModel: z.enum(["flat", "by_term"]),
    lookupKeyBase: lookupKeyBaseField,
    currency: trimmed.min(3).max(3).default("aud"),
    flatAmountMinor: z.number().finite().min(0).optional(),
    monthlyCost12Minor: z.number().finite().min(0).optional(),
    monthlyCost24Minor: z.number().finite().min(0).optional(),
    includedUsers: z.number().int().min(0).max(1_000_000).default(0),
    includedLocations: z.number().int().min(0).max(1_000_000).default(0),
    includedAdmins: z.number().int().min(0).max(1_000_000).default(0),
    upfrontCost12Minor: z.number().finite().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    const effectivePricing =
      data.billingType === "one_off" ? ("flat" as const) : data.pricingModel;

    if (effectivePricing === "flat") {
      if (typeof data.flatAmountMinor !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Price is required",
          path: ["flatAmountMinor"],
        });
      } else if (data.flatAmountMinor < STRIPE_MIN_MINOR) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Price must be at least ${STRIPE_MIN_MINOR / 100} AUD`,
          path: ["flatAmountMinor"],
        });
      }
    } else {
      if (typeof data.monthlyCost12Minor !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "12-month price is required",
          path: ["monthlyCost12Minor"],
        });
      } else if (data.monthlyCost12Minor < STRIPE_MIN_MINOR) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `12-month price must be at least ${STRIPE_MIN_MINOR / 100} AUD`,
          path: ["monthlyCost12Minor"],
        });
      }
      if (typeof data.monthlyCost24Minor !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "24-month price is required",
          path: ["monthlyCost24Minor"],
        });
      } else if (data.monthlyCost24Minor < STRIPE_MIN_MINOR) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `24-month price must be at least ${STRIPE_MIN_MINOR / 100} AUD`,
          path: ["monthlyCost24Minor"],
        });
      }
    }

    if (data.billingType === "one_off" && data.pricingModel === "by_term") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "One-off services use a single flat price",
        path: ["pricingModel"],
      });
    }
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

export function createInputToServiceTerms(input: CreateCatalogServiceInput): CatalogServiceTerm[] {
  const slug = resolveCreateCatalogSlug(input);
  const pricingModel = input.billingType === "one_off" ? "flat" : input.pricingModel;

  const terms: CatalogServiceTerm[] =
    pricingModel === "by_term"
      ? [
          {
            months: 12,
            monthlyAmountMinor: Math.round(input.monthlyCost12Minor ?? 0),
          },
          {
            months: 24,
            monthlyAmountMinor: Math.round(input.monthlyCost24Minor ?? 0),
          },
        ]
      : [
          {
            monthlyAmountMinor: Math.round(input.flatAmountMinor ?? 0),
          },
        ];

  return applyCatalogServiceTermLookupKeys(
    {
      slug,
      serviceType: input.serviceType,
      billingType: input.billingType,
      pricingModel,
    },
    terms,
  );
}

export function saveInputToCatalogTerms(
  existing: Pick<
    CatalogServiceRecord,
    "slug" | "serviceType" | "billingType" | "pricingModel" | "terms"
  >,
  input: SaveCatalogServiceInput,
  slug: string,
): CatalogServiceTerm[] {
  const pricingModel = existing.pricingModel ?? "by_term";
  const terms = saveInputToServiceTerms(input).map((t) => {
    const prev = existing.terms.find((p) => p.months === t.months);
    return {
      ...t,
      ...(prev?.stripePriceId ? { stripePriceId: prev.stripePriceId } : {}),
    };
  });

  return applyCatalogServiceTermLookupKeys(
    {
      slug,
      serviceType: existing.serviceType ?? "plan",
      billingType: existing.billingType ?? "recurring",
      pricingModel,
    },
    terms,
  );
}

export function resolveCreateCatalogSlug(input: CreateCatalogServiceInput): string {
  return normalizeLookupKeyBase(input.lookupKeyBase) || slugifyCatalogServiceName(input.name);
}
