import { getStripe } from "@/lib/stripe/server";
import type { SubscriptionProductOption } from "@/types/subscription-product";
import type Stripe from "stripe";

function recurringMonths(price: { interval?: string; interval_count?: number } | undefined): number | null {
  if (!price?.interval) return null;
  const count = Number.isFinite(price.interval_count) ? Number(price.interval_count) : 1;
  if (price.interval === "month") return count;
  if (price.interval === "year") return count * 12;
  return null;
}

function productDisplayName(product: Stripe.Price["product"]): string {
  if (typeof product === "string") return product;
  if (!product) return "";
  if ("deleted" in product && product.deleted) return product.id;
  return product.name?.trim() || product.id;
}

/** Active Stripe recurring prices grouped by product for admin subscription creation. */
export async function listStripeSubscriptionProductOptions(): Promise<SubscriptionProductOption[]> {
  const stripe = getStripe();
  if (!stripe) return [];

  const prices = await stripe.prices.list({
    active: true,
    type: "recurring",
    limit: 100,
    expand: ["data.product"],
  });

  const grouped = new Map<string, SubscriptionProductOption>();

  for (const p of prices.data) {
    const productObj = p.product;
    const productId = typeof productObj === "string" ? productObj : productObj?.id;
    const productName = productDisplayName(productObj);
    if (!productId || !productName) continue;
    if (typeof p.unit_amount !== "number") continue;
    const months = recurringMonths(p.recurring ?? undefined);
    if (!months) continue;

    const current =
      grouped.get(productId) ??
      ({
        productId,
        productName,
        durations: [],
      } satisfies SubscriptionProductOption);

    const existing = current.durations.find((d) => d.months === months);
    if (!existing) {
      current.durations.push({
        months,
        priceId: p.id,
        currency: (p.currency ?? "aud").toLowerCase(),
        unitAmountMinor: p.unit_amount,
      });
    }
    grouped.set(productId, current);
  }

  return [...grouped.values()]
    .map((g) => ({
      ...g,
      durations: [...g.durations].sort((a, b) => a.months - b.months),
    }))
    .filter((g) => g.durations.length > 0)
    .sort((a, b) => a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }));
}
