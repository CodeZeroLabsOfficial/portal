import type Stripe from "stripe";
import { catalogServicePriceLookupKey } from "@/lib/catalog-service-slug";
import { logError } from "@/lib/logging";
import type { CatalogServiceRecord, CatalogServiceTerm } from "@/types/catalog-service";

function termNeedsNewPrice(
  existing: CatalogServiceTerm,
  stripe: Stripe.Price | null,
): boolean {
  if (!existing.stripePriceId?.trim()) return true;
  if (!stripe || !stripe.active) return true;
  if (typeof stripe.unit_amount !== "number") return true;
  return stripe.unit_amount !== existing.monthlyAmountMinor;
}

/**
 * Creates or updates Stripe Product + recurring Prices for a catalogue service.
 * When amounts change, new Prices are created (Stripe Prices are immutable).
 */
export async function syncCatalogServiceToStripe(
  stripe: Stripe,
  service: CatalogServiceRecord,
): Promise<
  | {
      ok: true;
      stripeProductId: string;
      terms: CatalogServiceTerm[];
      stripeSyncedAt: number;
    }
  | { ok: false; message: string }
> {
  const slug = service.slug.trim() || "service";
  const currency = (service.currency || "aud").toLowerCase();
  let productId = service.stripeProductId?.trim();

  try {
    if (!productId) {
      const product = await stripe.products.create({
        name: service.name.trim() || "Service",
        metadata: {
          catalog_service_id: service.id,
          organization_id: service.organizationId,
        },
      });
      productId = product.id;
    } else {
      await stripe.products.update(productId, {
        name: service.name.trim() || undefined,
        metadata: {
          catalog_service_id: service.id,
          organization_id: service.organizationId,
        },
      });
    }

    const updatedTerms: CatalogServiceTerm[] = [];

    for (const term of service.terms) {
      let existingPrice: Stripe.Price | null = null;
      if (term.stripePriceId?.trim()) {
        try {
          existingPrice = await stripe.prices.retrieve(term.stripePriceId.trim());
        } catch {
          existingPrice = null;
        }
      }

      if (!termNeedsNewPrice(term, existingPrice)) {
        updatedTerms.push({
          months: term.months,
          monthlyAmountMinor: term.monthlyAmountMinor,
          stripePriceId: term.stripePriceId!.trim(),
        });
        continue;
      }

      const lookupKey = catalogServicePriceLookupKey(slug, term.months);
      const created = await stripe.prices.create({
        product: productId,
        currency,
        unit_amount: term.monthlyAmountMinor,
        recurring: { interval: "month", interval_count: 1 },
        lookup_key: lookupKey,
        transfer_lookup_key: true,
        metadata: {
          catalog_service_id: service.id,
          duration_months: String(term.months),
        },
      });

      updatedTerms.push({
        months: term.months,
        monthlyAmountMinor: term.monthlyAmountMinor,
        stripePriceId: created.id,
      });
    }

    if (updatedTerms.length === 0) {
      return { ok: false, message: "Service must define 12- and 24-month pricing." };
    }

    const missingPrice = updatedTerms.some((t) => !t.stripePriceId?.startsWith("price_"));
    if (missingPrice) {
      return { ok: false, message: "Could not create Stripe prices for all terms." };
    }

    return {
      ok: true,
      stripeProductId: productId,
      terms: updatedTerms,
      stripeSyncedAt: Date.now(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe sync failed.";
    logError("catalog_service_stripe_sync_failed", { serviceId: service.id, message });
    return { ok: false, message };
  }
}
