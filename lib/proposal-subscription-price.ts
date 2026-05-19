import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import { resolveStripePriceIdFromTierForBilling } from "@/lib/proposal-subscription-from-catalog";
import type { PackagesBlock, ProposalBlock, ProposalPublicSelections, ProposalRecord } from "@/types/proposal";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type { SubscriptionProductOption } from "@/types/subscription-product";

/**
 * First Stripe Price id tied to the buyer's package selection, else the first
 * `payment` block with `stripePriceId`.
 */
export function resolveSubscriptionStripePriceIdFromBlocks(
  blocks: ProposalBlock[],
  publicSelections?: ProposalPublicSelections,
  catalogServices?: CatalogServicePickerOption[] | null,
  stripeProductCatalog?: SubscriptionProductOption[] | null,
): string | null {
  const selections = publicSelections ?? {};
  const services = catalogServices ?? [];
  const stripeCatalog = stripeProductCatalog ?? [];

  for (const block of iterateProposalContentBlocks(blocks)) {
    if (block.type !== "packages") continue;
    const pb = block as PackagesBlock;
    const sel = selections[pb.id];
    if (!sel || sel.kind !== "packages") continue;
    const tier = pb.tiers.find((t) => t.id === sel.tierId);
    const fromBilling = resolveStripePriceIdFromTierForBilling(
      tier,
      sel.term,
      services,
      stripeCatalog,
    );
    if (fromBilling) return fromBilling;
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
  catalogServices?: CatalogServicePickerOption[] | null,
  stripeProductCatalog?: SubscriptionProductOption[] | null,
): string | null {
  return resolveSubscriptionStripePriceIdFromBlocks(
    proposal.document.blocks,
    proposal.publicSelections,
    catalogServices,
    stripeProductCatalog,
  );
}
