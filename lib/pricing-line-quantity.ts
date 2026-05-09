import type { PricingLineItem } from "@/types/proposal";

/**
 * Quantity for maths and display. Persisted values ≥ 0 apply; omitted uses 1 so
 * legacy line items behave as before. Supports add-on rows starting at 0.
 */
export function effectivePricingLineQuantity(li: PricingLineItem): number {
  const q = li.quantity;
  if (typeof q === "number" && Number.isFinite(q) && q >= 0) {
    return Math.floor(q);
  }
  return 1;
}
