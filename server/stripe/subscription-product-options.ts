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
  const m = text.match(/(\d{1,3})\s*months?/i);
  if (!m) return null;
  const months = Number(m[1]);
  return Number.isFinite(months) && months > 0 ? months : null;
}

function durationMonthsFromPrice(price: Stripe.Price): number | null {
  const metadataCandidates = [
    price.metadata?.term_months,
    price.metadata?.duration_months,
    price.metadata?.contract_months,
    price.metadata?.months,
  ];
  for (const v of metadataCandidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const fromNickname = parseMonthsFromText(price.nickname ?? undefined);
  if (fromNickname) return fromNickname;

  const fromLookupKey = parseMonthsFromText(price.lookup_key ?? undefined);
  if (fromLookupKey) return fromLookupKey;

  return recurringMonths(price.recurring ?? undefined);
}

interface PriceWithDerivedMonths {
  price: Stripe.Price;
  months: number | null;
}

function inferMissingContractTerms(rows: PriceWithDerivedMonths[]): PriceWithDerivedMonths[] {
  const unresolved = rows.filter((r) => !r.months);
  if (unresolved.length === 0) return rows;

  // Common setup: two monthly prices represent 12 vs 24 month commitments.
  // Higher monthly amount is usually shorter term (12m), lower is longer (24m).
  if (rows.length === 2 && unresolved.length === 2) {
    const sorted = [...rows].sort((a, b) => {
      const aa = typeof a.price.unit_amount === "number" ? a.price.unit_amount : 0;
      const bb = typeof b.price.unit_amount === "number" ? b.price.unit_amount : 0;
      return bb - aa;
    });
    return sorted.map((r, i) => ({ ...r, months: i === 0 ? 12 : 24 }));
  }

  return rows.map((r) => ({ ...r, months: r.months ?? recurringMonths(r.price.recurring ?? undefined) }));
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
    const resolved = inferMissingContractTerms(
      productPrices.map((price) => ({ price, months: durationMonthsFromPrice(price) })),
    );

    for (const row of resolved) {
      if (!row.months) continue;
      const existing = current.durations.find((d) => d.months === row.months);
      if (existing) continue;
      current.durations.push({
        months: row.months,
        priceId: row.price.id,
        currency: (row.price.currency ?? "aud").toLowerCase(),
        unitAmountMinor: row.price.unit_amount ?? 0,
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
}
