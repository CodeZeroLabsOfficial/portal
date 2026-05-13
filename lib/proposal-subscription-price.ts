import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import type { PackagesBlock, ProposalBlock, ProposalPublicSelections, ProposalRecord } from "@/types/proposal";

/**
 * First Stripe Price id tied to the buyer's package selection, else the first
 * `payment` block with `stripePriceId`.
 */
export function resolveSubscriptionStripePriceIdFromBlocks(
  blocks: ProposalBlock[],
  publicSelections?: ProposalPublicSelections,
): string | null {
  const selections = publicSelections ?? {};

  for (const block of iterateProposalContentBlocks(blocks)) {
    if (block.type !== "packages") continue;
    const pb = block as PackagesBlock;
    const sel = selections[pb.id];
    if (!sel || sel.kind !== "packages") continue;
    const tier = pb.tiers.find((t) => t.id === sel.tierId);
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

export function resolveSubscriptionStripePriceIdFromProposal(proposal: ProposalRecord): string | null {
  return resolveSubscriptionStripePriceIdFromBlocks(
    proposal.document.blocks,
    proposal.publicSelections,
  );
}
