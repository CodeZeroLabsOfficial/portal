import type Stripe from "stripe";
import { resolveCatalogServiceTermLookupKey, slugifyCatalogServiceName } from "@/lib/catalog-service-slug";
import { logError } from "@/lib/logging";
import type { CatalogServiceRecord, CatalogServiceTerm } from "@/types/catalog-service";

const STRIPE_MIN_UNIT_AMOUNT = 50;

function normalizedSlug(service: CatalogServiceRecord): string {
  const raw = service.slug?.trim();
  if (raw) return raw.slice(0, 40);
  return slugifyCatalogServiceName(service.name);
}

function effectiveBillingType(service: CatalogServiceRecord): "recurring" | "one_off" {
  return service.billingType === "one_off" ? "one_off" : "recurring";
}

function effectivePricingModel(service: CatalogServiceRecord): "flat" | "by_term" {
  if (service.pricingModel === "flat" || service.pricingModel === "by_term") {
    return service.pricingModel;
  }
  return service.terms.length >= 2 ? "by_term" : "flat";
}

function termNeedsNewPrice(
  term: CatalogServiceTerm,
  stripe: Stripe.Price | null,
  expectedLookupKey: string,
  billingType: "recurring" | "one_off",
): boolean {
  if (!term.stripePriceId?.trim()) return true;
  if (!stripe || !stripe.active) return true;
  const currentKey = stripe.lookup_key?.trim() ?? "";
  if (currentKey !== expectedLookupKey) return true;
  if (typeof stripe.unit_amount !== "number") return true;
  if (stripe.unit_amount !== term.monthlyAmountMinor) return true;
  const isRecurring = Boolean(stripe.recurring);
  if (billingType === "recurring" && !isRecurring) return true;
  if (billingType === "one_off" && isRecurring) return true;
  return false;
}

/** Stripe Price nickname — not the catalogue description (that belongs on the Product only). */
function priceNickname(
  serviceName: string,
  term: CatalogServiceTerm,
  billingType: "recurring" | "one_off",
): string {
  const label = serviceName.trim() || "Service";
  if (term.months === 12) return `${label} · 12 month term`;
  if (term.months === 24) return `${label} · 24 month term`;
  if (billingType === "one_off") return `${label} · one-off`;
  return `${label} · monthly`;
}

/**
 * Creates or updates Stripe Product + Prices for a catalogue service.
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
  const description = service.description?.trim() ?? "";
  const currency = (service.currency || "aud").toLowerCase();
  const billingType = effectiveBillingType(service);
  const pricingModel = effectivePricingModel(service);
  let productId = service.stripeProductId?.trim();

  const termsSorted = [...service.terms].sort((a, b) => (a.months ?? 0) - (b.months ?? 0));
  if (termsSorted.length === 0) {
    return { ok: false, message: "Add at least one price before syncing to Stripe." };
  }

  if (pricingModel === "by_term" && termsSorted.length < 2) {
    return { ok: false, message: "12- and 24-month prices are required for term-based pricing." };
  }

  for (const term of termsSorted) {
    if (term.monthlyAmountMinor < STRIPE_MIN_UNIT_AMOUNT) {
      const termLabel = term.months ? `${term.months}-month` : "price";
      return {
        ok: false,
        message: `Set the ${termLabel} to at least ${STRIPE_MIN_UNIT_AMOUNT / 100} ${currency.toUpperCase()} before syncing to Stripe.`,
      };
    }
  }

  try {
    const productPayload: Stripe.ProductCreateParams = {
      name: serviceName,
      ...(description ? { description } : {}),
      metadata: {
        catalog_service_id: service.id,
        organization_id: service.organizationId,
        service_slug: slug,
        ...(service.serviceType ? { service_type: service.serviceType } : {}),
      },
    };

    if (!productId) {
      const product = await stripe.products.create(productPayload);
      productId = product.id;
    } else {
      await stripe.products.update(productId, {
        name: serviceName,
        ...(description ? { description } : {}),
        metadata: productPayload.metadata,
      });
    }

    const updatedTerms: CatalogServiceTerm[] = [];

    for (const term of termsSorted) {
      const lookupKey = resolveCatalogServiceTermLookupKey(service, term);
      let existingPrice: Stripe.Price | null = null;
      if (term.stripePriceId?.trim()) {
        try {
          existingPrice = await stripe.prices.retrieve(term.stripePriceId.trim());
        } catch {
          existingPrice = null;
        }
      }

      if (!termNeedsNewPrice(term, existingPrice, lookupKey, billingType)) {
        updatedTerms.push({
          ...term,
          lookupKey,
          stripePriceId: term.stripePriceId!.trim(),
        });
        continue;
      }

      const priceParams: Stripe.PriceCreateParams = {
        product: productId,
        currency,
        unit_amount: term.monthlyAmountMinor,
        nickname: priceNickname(serviceName, term, billingType),
        lookup_key: lookupKey,
        transfer_lookup_key: true,
        metadata: {
          catalog_service_id: service.id,
          service_slug: slug,
          lookup_key: lookupKey,
          ...(term.months ? { duration_months: String(term.months) } : {}),
          ...(service.serviceType ? { service_type: service.serviceType } : {}),
          billing_type: billingType,
        },
      };

      if (billingType === "recurring") {
        priceParams.recurring = { interval: "month", interval_count: 1 };
      }

      const created = await stripe.prices.create(priceParams);

      updatedTerms.push({
        months: term.months,
        monthlyAmountMinor: term.monthlyAmountMinor,
        lookupKey,
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
