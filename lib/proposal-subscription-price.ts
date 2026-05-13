import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import { resolveStripePriceIdFromTierWithCatalog } from "@/lib/proposal-subscription-from-catalog";
import type { PackagesBlock, ProposalBlock, ProposalPublicSelections, ProposalRecord } from "@/types/proposal";
import type { SubscriptionProductOption } from "@/types/subscription-product";

/**
 * First Stripe Price id tied to the buyer's package selection, else the first
 * `payment` block with `stripePriceId`.
 *
 * When `catalog` is provided (same list as the Add subscription modal), tiers
 * with `stripeProductId` resolve to the price for the buyer’s selected term
 * (12 vs 24 months).
 */
export function resolveSubscriptionStripePriceIdFromBlocks(
  blocks: ProposalBlock[],
  publicSelections?: ProposalPublicSelections,
  catalog?: SubscriptionProductOption[] | null,
): string | null {
  const selections = publicSelections ?? {};

  for (const block of iterateProposalContentBlocks(blocks)) {
    if (block.type !== "packages") continue;
    const pb = block as PackagesBlock;
    const sel = selections[pb.id];
    if (!sel || sel.kind !== "packages") continue;
    const tier = pb.tiers.find((t) => t.id === sel.tierId);
    if (catalog && catalog.length > 0) {
      const fromCatalog = resolveStripePriceIdFromTierWithCatalog(tier, sel.term, catalog);
      if (fromCatalog) return fromCatalog;
    }
    const pid = tier?.stripePriceId?.trim();
    if (pid) return pid;
  }

  for (const block of iterateProposalContentBlocks(blocks)) {
    if (block.type === "payment") {
      const pid = block.stripePriceId?.trim();
      if (pid) return pid;
    }
  }

  return null;
}

export function resolveSubscriptionStripePriceIdFromProposal(
  proposal: ProposalRecord,
  catalog?: SubscriptionProductOption[] | null,
): string | null {
  return resolveSubscriptionStripePriceIdFromBlocks(
    proposal.document.blocks,
    proposal.publicSelections,
    catalog,
  );
}
