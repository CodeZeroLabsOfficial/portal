import type { PackagesBlock, PackagesPublicSelection, PricingLineItem } from "@/types/proposal";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";

/** Whether add-ons contribute to UI and billing for this block. */
export function packagesAddonsSectionActive(block: PackagesBlock): boolean {
  if (block.addonsSectionEnabled === true) return true;
  if (block.addonsSectionEnabled === false) return false;
  return (block.addonLineItems ?? []).length > 0;
}

export function packageTermMonths(sel: Pick<PackagesPublicSelection, "term">): number {
  return sel.term === "24_months" ? 24 : 12;
}

/** Contract-style plan total (months × tier monthly rate). */
export function packagePlanContractMinor(block: PackagesBlock, sel: PackagesPublicSelection): number {
  const tier = block.tiers.find((t) => t.id === sel.tierId);
  if (!tier) return 0;
  const months = packageTermMonths(sel);
  const monthly =
    sel.term === "24_months" ? (tier.monthlyCost24Minor ?? 0) : (tier.monthlyCost12Minor ?? 0);
  return monthly * months;
}

/** Per-month recurring total: tier rate plus add-on line totals (each line is a monthly amount). */
export function packageMonthlyTotalMinor(block: PackagesBlock, sel: PackagesPublicSelection): number {
  const tier = block.tiers.find((t) => t.id === sel.tierId);
  if (!tier) return 0;
  const monthly =
    sel.term === "24_months" ? (tier.monthlyCost24Minor ?? 0) : (tier.monthlyCost12Minor ?? 0);
  return monthly + packageAddonsTotalMinor(block, sel);
}

/** Full contract value: plan commitment plus add-ons billed each month for the term. */
export function packageCommitmentTotalMinor(block: PackagesBlock, sel: PackagesPublicSelection): number {
  return packagePlanContractMinor(block, sel) + packageAddonsTotalMinor(block, sel) * packageTermMonths(sel);
}

function addonLineTotal(
  li: PricingLineItem,
  qtyMap: Record<string, number> | undefined,
  optionalOff: Record<string, boolean> | undefined,
): number {
  if (li.optional && optionalOff?.[li.id]) return 0;
  const raw = qtyMap?.[li.id];
  const q =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 0
      ? Math.floor(raw)
      : effectivePricingLineQuantity(li);
  return Math.round(li.unitAmountMinor * q);
}

/** Sum of add-on line totals (per month) using persisted selection and/or live viewer maps. */
export function packageAddonsTotalMinor(
  block: PackagesBlock,
  sel: Pick<PackagesPublicSelection, "addonQuantities" | "addonOptionalOff"> | undefined,
  liveQty?: Record<string, number>,
  liveOptOff?: Record<string, boolean>,
): number {
  if (!packagesAddonsSectionActive(block)) return 0;
  const items = block.addonLineItems ?? [];
  const qtyMap = { ...sel?.addonQuantities, ...liveQty };
  const optOff = { ...sel?.addonOptionalOff, ...liveOptOff };
  let sum = 0;
  for (const li of items) {
    sum += addonLineTotal(li, qtyMap, optOff);
  }
  return sum;
}
