import { resolveSubscriptionStripePriceIdFromProposal } from "@/lib/proposal-subscription-price";
import type { ProposalRecord } from "@/types/proposal";
import { loadBillingCatalogForOrganization } from "@/server/catalog/billing-catalog";

/** Resolves `price_…` from portal catalogue services (legacy Stripe product fallback). */
export async function resolveSubscriptionStripePriceIdForProposalWithStripe(
  proposal: ProposalRecord,
): Promise<string | null> {
  const { catalogServices, stripeProductCatalog } = await loadBillingCatalogForOrganization(
    proposal.organizationId,
  );
  return resolveSubscriptionStripePriceIdFromProposal(
    proposal,
    catalogServices,
    stripeProductCatalog,
  );
}
