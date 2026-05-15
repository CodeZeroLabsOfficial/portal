import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import type {
  PackagesBlock,
  ProposalBlock,
  ProposalPublicSelections,
  ProposalRecord,
  ProposalStatus,
} from "@/types/proposal";

/** After acceptance or other terminal outcomes, public viewers must not change package / add-on rows. */
export function isPublicProposalPackageSelectionsLocked(status: ProposalStatus | undefined): boolean {
  return status === "accepted" || status === "declined" || status === "expired";
}

/** Every `packages` block in the document (nested blocks included). */
export function listPackagesBlocksInDocument(blocks: ProposalBlock[]): PackagesBlock[] {
  const out: PackagesBlock[] = [];
  for (const b of iterateProposalContentBlocks(blocks)) {
    if (b.type === "packages") out.push(b);
  }
  return out;
}

/**
 * True when the document has no package blocks, or every package block has a
 * valid persisted selection for the linked tier.
 */
export function isDocumentPackageSelectionComplete(
  documentBlocks: ProposalBlock[],
  publicSelections?: ProposalPublicSelections,
): boolean {
  const packagesBlocks = listPackagesBlocksInDocument(documentBlocks);
  if (packagesBlocks.length === 0) return true;
  const selMap = publicSelections ?? {};
  for (const pb of packagesBlocks) {
    const sel = selMap[pb.id];
    if (!sel || sel.kind !== "packages") return false;
    if (!sel.tierId || !pb.tiers.some((t) => t.id === sel.tierId)) return false;
  }
  return true;
}

/**
 * True when the proposal has no package blocks, or every package block has a
 * valid persisted selection for the linked tier.
 */
export function isProposalPackageSelectionComplete(proposal: ProposalRecord): boolean {
  return isDocumentPackageSelectionComplete(proposal.document.blocks, proposal.publicSelections);
}
