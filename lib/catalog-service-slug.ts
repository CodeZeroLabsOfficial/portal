import type {
  CatalogServiceBillingType,
  CatalogServiceKind,
  CatalogServicePricingModel,
  CatalogServiceRecord,
  CatalogServiceTerm,
  CatalogServiceTermMonths,
} from "@/types/catalog-service";

/** Stable base segment for lookup keys and Firestore `slug`. */
export function slugifyCatalogServiceName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base.length > 0 ? base : "service";
}

export function normalizeLookupKeyBase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export interface CatalogServiceLookupContext {
  lookupKeyBase: string;
  serviceType: CatalogServiceKind;
  billingType: CatalogServiceBillingType;
  pricingModel: CatalogServicePricingModel;
}

/** Stripe lookup key for catalogue services created with the new model. */
export function buildCatalogServicePriceLookupKey(
  ctx: CatalogServiceLookupContext,
  months?: CatalogServiceTermMonths,
): string {
  const base = normalizeLookupKeyBase(ctx.lookupKeyBase);
  const kind = ctx.serviceType === "plan" ? "plan" : "addon";

  if (ctx.pricingModel === "by_term" && months) {
    return `${base}_${kind}_${months}_months`;
  }
  if (ctx.billingType === "one_off") {
    return `${base}_${kind}_one_off`;
  }
  return `${base}_${kind}`;
}

/** Pre-migration lookup keys (`{slug}_12_months`). */
export function legacyCatalogServicePriceLookupKey(
  slug: string,
  months: CatalogServiceTermMonths,
): string {
  return `${normalizeLookupKeyBase(slug)}_${months}_months`;
}

export function catalogServiceLookupContext(
  service: Pick<
    CatalogServiceRecord,
    "slug" | "serviceType" | "billingType" | "pricingModel"
  >,
): CatalogServiceLookupContext {
  return {
    lookupKeyBase: service.slug,
    serviceType: service.serviceType ?? "plan",
    billingType: service.billingType ?? "recurring",
    pricingModel: service.pricingModel ?? "by_term",
  };
}

export function isLegacyCatalogService(
  service: Pick<CatalogServiceRecord, "serviceType" | "pricingModel" | "billingType">,
): boolean {
  return !service.serviceType;
}

function computedCatalogServiceTermLookupKey(
  service: Pick<
    CatalogServiceRecord,
    "slug" | "serviceType" | "billingType" | "pricingModel"
  >,
  term: Pick<CatalogServiceTerm, "months">,
): string {
  const months = term.months;
  if (isLegacyCatalogService(service)) {
    return legacyCatalogServicePriceLookupKey(service.slug, months ?? 12);
  }
  return buildCatalogServicePriceLookupKey(catalogServiceLookupContext(service as CatalogServiceRecord), months);
}

/** Persist fully-qualified Stripe lookup keys on each term (not just the base segment from the form). */
export function applyCatalogServiceTermLookupKeys(
  service: Pick<
    CatalogServiceRecord,
    "slug" | "serviceType" | "billingType" | "pricingModel"
  >,
  terms: CatalogServiceTerm[],
): CatalogServiceTerm[] {
  return terms.map((term) => ({
    ...term,
    lookupKey: computedCatalogServiceTermLookupKey(service, term),
  }));
}

export function resolveCatalogServiceTermLookupKey(
  service: CatalogServiceRecord,
  term: CatalogServiceTerm,
): string {
  const computed = computedCatalogServiceTermLookupKey(service, term);
  const stored = term.lookupKey?.trim();
  if (!stored) return computed;

  const base = normalizeLookupKeyBase(service.slug);
  if (stored === base || stored === service.slug.trim()) {
    return computed;
  }
  return stored;
}

/** @deprecated Use {@link buildCatalogServicePriceLookupKey} or {@link resolveCatalogServiceTermLookupKey}. */
export function catalogServicePriceLookupKey(slug: string, months: 12 | 24): string {
  return legacyCatalogServicePriceLookupKey(slug, months);
}

export function previewCatalogServiceLookupKeys(ctx: CatalogServiceLookupContext): string[] {
  if (ctx.pricingModel === "by_term") {
    return [
      buildCatalogServicePriceLookupKey(ctx, 12),
      buildCatalogServicePriceLookupKey(ctx, 24),
    ];
  }
  return [buildCatalogServicePriceLookupKey(ctx)];
}
