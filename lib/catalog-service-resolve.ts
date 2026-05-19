import type { CatalogServicePickerOption, CatalogServiceRecord } from "@/types/catalog-service";
import type { PackageTier, PackagesPublicSelection } from "@/types/proposal";
import type { SubscriptionProductOption } from "@/types/subscription-product";
import { packagesTermToDurationMonths } from "@/lib/proposal-subscription-from-catalog";
import { resolveStripePriceIdFromTierWithCatalog } from "@/lib/proposal-subscription-from-catalog";

export function resolveStripePriceIdFromCatalogService(
  service: CatalogServiceRecord | CatalogServicePickerOption | undefined,
  durationMonths: 12 | 24,
): string | null {
  if (!service) return null;
  const terms = "terms" in service ? service.terms : service.durations;
  const pricingModel =
    "pricingModel" in service && service.pricingModel
      ? service.pricingModel
      : terms.length >= 2
        ? "by_term"
        : "flat";

  let match = terms.find((t) => t.months === durationMonths);
  if (!match && pricingModel === "flat" && terms.length > 0) {
    match = terms[0];
  }

  const pid =
    "stripePriceId" in (match ?? {})
      ? (match as { stripePriceId?: string })?.stripePriceId?.trim()
      : (match as { priceId?: string })?.priceId?.trim();
  return pid?.startsWith("price_") ? pid : null;
}

export function resolveStripePriceIdFromTier(
  tier: PackageTier | undefined,
  term: PackagesPublicSelection["term"],
  catalogServices: CatalogServicePickerOption[],
  stripeProductCatalog: SubscriptionProductOption[] = [],
): string | null {
  if (!tier) return null;

  const serviceId = tier.serviceId?.trim();
  if (serviceId) {
    const service = catalogServices.find((s) => s.serviceId === serviceId);
    if (service) {
      const months = packagesTermToDurationMonths(term);
      return resolveStripePriceIdFromCatalogService(service, months);
    }
  }

  return resolveStripePriceIdFromTierWithCatalog(tier, term, stripeProductCatalog);
}

export function resolveStripePriceIdForSubscription(
  serviceId: string,
  durationMonths: number,
  catalogServices: CatalogServicePickerOption[],
): string | null {
  const service = catalogServices.find((s) => s.serviceId === serviceId.trim());
  if (!service) return null;
  const months = durationMonths === 24 ? 24 : 12;
  return resolveStripePriceIdFromCatalogService(service, months);
}
