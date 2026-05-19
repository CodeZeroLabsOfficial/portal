import type Stripe from "stripe";
import { catalogServicePriceLookupKey, slugifyCatalogServiceName } from "@/lib/catalog-service-slug";
import { logError } from "@/lib/logging";
import type { CatalogServiceRecord, CatalogServiceTerm } from "@/types/catalog-service";

const STRIPE_MIN_UNIT_AMOUNT = 50;

function normalizedSlug(service: CatalogServiceRecord): string {
  const raw = service.slug?.trim();
  if (raw) return raw.slice(0, 40);
  return slugifyCatalogServiceName(service.name);
}

function termNeedsNewPrice(
  term: CatalogServiceTerm,
  stripe: Stripe.Price | null,
  expectedLookupKey: string,
): boolean {
  if (!term.stripePriceId?.trim()) return true;
  if (!stripe || !stripe.active) return true;
  const currentKey = stripe.lookup_key?.trim() ?? "";
  if (currentKey !== expectedLookupKey) return true;
  if (typeof stripe.unit_amount !== "number") return true;
  return stripe.unit_amount !== term.monthlyAmountMinor;
}

function priceNickname(serviceName: string, months: 12 | 24): string {
  const label = serviceName.trim() || "Service";
  return `${label} · ${months} months`;
}

/**
 * Creates or updates Stripe Product + recurring Prices for a catalogue service.
 * When amounts or lookup keys change, new Prices are created (Stripe Prices are immutable).
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
  const slug = normalizedSlug(service);
  const serviceName = service.name.trim() || "Service";
  const currency = (service.currency || "aud").toLowerCase();
  let productId = service.stripeProductId?.trim();

  const termsSorted = [...service.terms].sort((a, b) => a.months - b.months);
  if (termsSorted.length === 0) {
    return { ok: false, message: "Service must define 12- and 24-month pricing." };
  }

  for (const term of termsSorted) {
    if (term.monthlyAmountMinor < STRIPE_MIN_UNIT_AMOUNT) {
      return {
        ok: false,
        message: `Set the ${term.months}-month price to at least ${STRIPE_MIN_UNIT_AMOUNT / 100} ${currency.toUpperCase()} before syncing to Stripe.`,
      };
    }
  }

  try {
    if (!productId) {
      const product = await stripe.products.create({
        name: serviceName,
        metadata: {
          catalog_service_id: service.id,
          organization_id: service.organizationId,
          service_slug: slug,
        },
      });
      productId = product.id;
    } else {
      await stripe.products.update(productId, {
        name: serviceName,
        metadata: {
          catalog_service_id: service.id,
          organization_id: service.organizationId,
          service_slug: slug,
        },
      });
    }

    const updatedTerms: CatalogServiceTerm[] = [];

    for (const term of termsSorted) {
      const lookupKey = catalogServicePriceLookupKey(slug, term.months);
      let existingPrice: Stripe.Price | null = null;
      if (term.stripePriceId?.trim()) {
        try {
          existingPrice = await stripe.prices.retrieve(term.stripePriceId.trim());
        } catch {
          existingPrice = null;
        }
      }

      if (!termNeedsNewPrice(term, existingPrice, lookupKey)) {
        updatedTerms.push({
          months: term.months,
          monthlyAmountMinor: term.monthlyAmountMinor,
          stripePriceId: term.stripePriceId!.trim(),
        });
        continue;
      }

      const created = await stripe.prices.create({
        product: productId,
        currency,
        unit_amount: term.monthlyAmountMinor,
        nickname: priceNickname(serviceName, term.months),
        recurring: { interval: "month", interval_count: 1 },
        lookup_key: lookupKey,
        transfer_lookup_key: true,
        metadata: {
          catalog_service_id: service.id,
          duration_months: String(term.months),
          service_slug: slug,
          lookup_key: lookupKey,
        },
      });

      updatedTerms.push({
        months: term.months,
        monthlyAmountMinor: term.monthlyAmountMinor,
        stripePriceId: created.id,
      });
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
