import { resolveStripePriceIdFromCatalogService } from "@/lib/catalog-service-resolve";
import { packagesTermToDurationMonths } from "@/lib/proposal-subscription-from-catalog";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type { PackagesPublicSelection, PricingLineItem } from "@/types/proposal";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";

/** How an add-on line is billed when linked (or not) to the Services catalogue. */
export type ProposalAddonBillingKind = "recurring" | "one_off" | "manual_recurring";

export function catalogServiceForAddonLine(
  line: PricingLineItem,
  catalogServices: readonly CatalogServicePickerOption[],
): CatalogServicePickerOption | undefined {
  const sid = line.serviceId?.trim();
  if (!sid) return undefined;
  return catalogServices.find((s) => s.serviceId === sid);
}

/**
 * Classifies add-on billing. Without catalogue context, legacy behaviour treats
 * all add-ons as recurring (per-month × term).
 */
export function resolveProposalAddonBillingKind(
  line: PricingLineItem,
  catalogServices?: readonly CatalogServicePickerOption[],
): ProposalAddonBillingKind {
  if (!catalogServices || catalogServices.length === 0) return "manual_recurring";
  const service = catalogServiceForAddonLine(line, catalogServices);
  if (!service) return "manual_recurring";
  if (service.billingType === "one_off") return "one_off";
  return "recurring";
}

export function addonQuantityForSelection(
  line: PricingLineItem,
  sel: Pick<PackagesPublicSelection, "addonQuantities"> | undefined,
  liveQty?: Record<string, number>,
): number {
  const raw = liveQty?.[line.id] ?? sel?.addonQuantities?.[line.id];
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  return effectivePricingLineQuantity(line);
}

export function resolveCatalogAddonStripePriceId(
  service: CatalogServicePickerOption,
  term: PackagesPublicSelection["term"],
): string | null {
  const months = packagesTermToDurationMonths(term);
  return resolveStripePriceIdFromCatalogService(service, months);
}
