import { logError } from "@/lib/logging";
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

function parseMonthsFromText(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d{1,3})(?:\s*|[_-]+)months?/i);
  if (!m) return null;
  const months = Number(m[1]);
  return Number.isFinite(months) && months > 0 ? months : null;
}

function durationMonthsFromPrice(price: Stripe.Price): number | null {
  // Deterministic mapping: lookup key naming convention in Stripe.
  // Examples: premium_plan_12_months, premium_plan_24_months
  const fromLookupKey = parseMonthsFromText(price.lookup_key ?? undefined);
  return fromLookupKey;
}

function productDisplayName(product: Stripe.Price["product"]): string {
  if (typeof product === "string") return product;
  if (!product) return "";
  if ("deleted" in product && product.deleted) return product.id;
  return product.name?.trim() || product.id;
}

/** Active Stripe recurring prices grouped by product for admin subscription creation. */
export async function listStripeSubscriptionProductOptions(): Promise<SubscriptionProductOption[]> {
  try {
    const stripe = getStripe();
    if (!stripe) return [];

    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      limit: 100,
      expand: ["data.product"],
    });

    const grouped = new Map<string, SubscriptionProductOption>();

    const rawByProduct = new Map<string, Stripe.Price[]>();
    for (const p of prices.data) {
      const productObj = p.product;
      const productId = typeof productObj === "string" ? productObj : productObj?.id;
      const productName = productDisplayName(productObj);
      if (!productId || !productName) continue;
      if (typeof p.unit_amount !== "number") continue;
      const bucket = rawByProduct.get(productId) ?? [];
      bucket.push(p);
      rawByProduct.set(productId, bucket);
      if (!grouped.has(productId)) {
        grouped.set(
          productId,
          {
            productId,
            productName,
            durations: [],
          } satisfies SubscriptionProductOption,
        );
      }
    }

    for (const [productId, productPrices] of rawByProduct) {
      const current = grouped.get(productId);
      if (!current) continue;
      for (const price of productPrices) {
        const months = durationMonthsFromPrice(price);
        if (!months) continue;
        const existing = current.durations.find((d) => d.months === months);
        if (existing) continue;
        current.durations.push({
          months,
          priceId: price.id,
          currency: (price.currency ?? "aud").toLowerCase(),
          unitAmountMinor: price.unit_amount ?? 0,
        });
      }
    }

    return [...grouped.values()]
      .map((g) => ({
        ...g,
        durations: [...g.durations].sort((a, b) => a.months - b.months),
      }))
      .filter((g) => g.durations.length > 0)
      .sort((a, b) => a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logError("stripe_subscription_product_options_failed", { message });
    return [];
  }
}
