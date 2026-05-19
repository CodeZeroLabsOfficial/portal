import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type { PackageTier, PricingLineItem } from "@/types/proposal";

/** Plans only — excludes add-ons (and legacy flat-priced services) from package tier pickers. */
export function isCatalogServicePlanPickerOption(
  service: Pick<CatalogServicePickerOption, "serviceType" | "pricingModel">,
): boolean {
  if (service.serviceType === "addon") return false;
  if (service.serviceType === "plan") return true;
  return service.pricingModel === "by_term";
}

/** Add-ons only — Services catalogue rows with `serviceType: "addon"`. */
export function isCatalogServiceAddonPickerOption(
  service: Pick<CatalogServicePickerOption, "serviceType">,
): boolean {
  return service.serviceType === "addon";
}

export function catalogAddonUnitAmountForTerm(
  service: CatalogServicePickerOption,
  term: "12_months" | "24_months",
): number {
  const months = term === "24_months" ? 24 : 12;
  return (
    service.durations.find((d) => d.months === months)?.unitAmountMinor ??
    service.durations[0]?.unitAmountMinor ??
    0
  );
}

export function pricingLineItemFromCatalogAddon(
  service: CatalogServicePickerOption,
  term: "12_months" | "24_months",
  lineId: string,
): PricingLineItem {
  const unitAmount12Minor = catalogAddonUnitAmountForTerm(service, "12_months");
  const unitAmount24Minor = catalogAddonUnitAmountForTerm(service, "24_months");
  return {
    id: lineId,
    label: service.serviceName,
    unitAmountMinor: catalogAddonUnitAmountForTerm(service, term),
    unitAmount12Minor,
    unitAmount24Minor,
    quantity: 0,
    serviceId: service.serviceId,
  };
}

export function effectiveCatalogAddonUnitAmount(
  li: PricingLineItem,
  term: "12_months" | "24_months" | undefined,
): number {
  if (term === "24_months" && typeof li.unitAmount24Minor === "number") {
    return li.unitAmount24Minor;
  }
  if (term === "12_months" && typeof li.unitAmount12Minor === "number") {
    return li.unitAmount12Minor;
  }
  return li.unitAmountMinor;
}

export function syncCatalogAddonLineItemsForTerm(
  lines: PricingLineItem[],
  term: "12_months" | "24_months",
  catalogAddons: readonly CatalogServicePickerOption[],
): PricingLineItem[] {
  if (lines.length === 0 || catalogAddons.length === 0) return lines;
  let changed = false;
  const next = lines.map((li) => {
    const sid = li.serviceId?.trim();
    if (!sid) return li;
    const service = catalogAddons.find((s) => s.serviceId === sid);
    if (!service) return li;
    const unitAmount12Minor = catalogAddonUnitAmountForTerm(service, "12_months");
    const unitAmount24Minor = catalogAddonUnitAmountForTerm(service, "24_months");
    const unitAmountMinor = catalogAddonUnitAmountForTerm(service, term);
    const label = service.serviceName;
    if (
      li.unitAmountMinor === unitAmountMinor &&
      li.unitAmount12Minor === unitAmount12Minor &&
      li.unitAmount24Minor === unitAmount24Minor &&
      li.label === label
    ) {
      return li;
    }
    changed = true;
    return { ...li, unitAmountMinor, unitAmount12Minor, unitAmount24Minor, label };
  });
  return changed ? next : lines;
}

export function packageTierFromCatalogService(
  service: CatalogServicePickerOption,
  tierId: string,
): PackageTier {
  const d12 = service.durations.find((d) => d.months === 12);
  const d24 = service.durations.find((d) => d.months === 24);
  return {
    id: tierId,
    name: service.serviceName,
    serviceId: service.serviceId,
    includedUsers: service.includedUsers,
    includedLocations: service.includedLocations,
    includedAdmins: service.includedAdmins,
    monthlyCost12Minor: d12?.unitAmountMinor ?? 0,
    monthlyCost24Minor: d24?.unitAmountMinor ?? 0,
    ...(typeof service.upfrontCost12Minor === "number" ? { upfrontCost12Minor: service.upfrontCost12Minor } : {}),
    features: [...service.features],
  };
}
