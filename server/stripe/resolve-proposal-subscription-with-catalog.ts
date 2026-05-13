import { resolveSubscriptionStripePriceIdFromProposal } from "@/lib/proposal-subscription-price";
import type { ProposalRecord } from "@/types/proposal";
import { getStripe } from "@/lib/stripe/server";
import { listStripeSubscriptionProductOptions } from "@/server/stripe/subscription-product-options";

/** Resolves `price_…` using Stripe catalog (same grouping as Add subscription). */
export async function resolveSubscriptionStripePriceIdForProposalWithStripe(
  proposal: ProposalRecord,
): Promise<string | null> {
  const stripe = getStripe();
  const catalog = stripe ? await listStripeSubscriptionProductOptions() : [];
  return resolveSubscriptionStripePriceIdFromProposal(proposal, catalog);
}
