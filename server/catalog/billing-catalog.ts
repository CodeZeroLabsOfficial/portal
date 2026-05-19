import { listCatalogServicePickerOptionsForOrganizationId } from "@/server/firestore/catalog-services";
import { listStripeSubscriptionProductOptions } from "@/server/stripe/subscription-product-options";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type { SubscriptionProductOption } from "@/types/subscription-product";

export interface BillingCatalogSnapshot {
  catalogServices: CatalogServicePickerOption[];
  /** Legacy Stripe-discovered products when catalogue rows are empty or for old tiers. */
  stripeProductCatalog: SubscriptionProductOption[];
}

/** Active catalogue services for an org, with Stripe API fallback for legacy tiers. */
export async function loadBillingCatalogForOrganization(
  organizationId: string | undefined,
): Promise<BillingCatalogSnapshot> {
  const [catalogServices, stripeProductCatalog] = await Promise.all([
    listCatalogServicePickerOptionsForOrganizationId(organizationId),
    listStripeSubscriptionProductOptions(),
  ]);
  return { catalogServices, stripeProductCatalog };
}
