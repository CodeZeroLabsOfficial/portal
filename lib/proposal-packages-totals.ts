import type { PackagesBlock, PackagesPublicSelection, PricingLineItem } from "@/types/proposal";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";

/** Contract-style plan total (matches `computeProposalTotalMinor` package branch). */
export function packagePlanContractMinor(block: PackagesBlock, sel: PackagesPublicSelection): number {
  const tier = block.tiers.find((t) => t.id === sel.tierId);
  if (!tier) return 0;
  const months = sel.term === "24_months" ? 24 : 12;
  const monthly =
    sel.term === "24_months" ? (tier.monthlyCost24Minor ?? 0) : (tier.monthlyCost12Minor ?? 0);
  return monthly * months;
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

/** Sum of add-on line totals using persisted selection and/or live viewer maps. */
export function packageAddonsTotalMinor(
  block: PackagesBlock,
  sel: Pick<PackagesPublicSelection, "addonQuantities" | "addonOptionalOff"> | undefined,
  liveQty?: Record<string, number>,
  liveOptOff?: Record<string, boolean>,
): number {
  const items = block.addonLineItems ?? [];
  const qtyMap = { ...sel?.addonQuantities, ...liveQty };
  const optOff = { ...sel?.addonOptionalOff, ...liveOptOff };
  let sum = 0;
  for (const li of items) {
    sum += addonLineTotal(li, qtyMap, optOff);
  }
  return sum;
}
