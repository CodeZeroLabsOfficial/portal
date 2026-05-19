import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type { PackageTier } from "@/types/proposal";

/** Plans only — excludes add-ons (and legacy flat-priced services) from package tier pickers. */
export function isCatalogServicePlanPickerOption(
  service: Pick<CatalogServicePickerOption, "serviceType" | "pricingModel">,
): boolean {
  if (service.serviceType === "addon") return false;
  if (service.serviceType === "plan") return true;
  return service.pricingModel === "by_term";
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
