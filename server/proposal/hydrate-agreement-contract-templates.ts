import {
  agreementBlockNeedsContractHydration,
  applyContractTemplateSnapshotToAgreementBlock,
  contractTemplateToAgreementSnapshot,
} from "@/lib/contract-template-agreement-snapshot";
import { getContractTemplatesForOrgByIds } from "@/server/firestore/contract-templates";
import type { AgreementBlock, ProposalBlock, ProposalDocument } from "@/types/proposal";

/**
 * Copies agreement title / intro / legal HTML from linked contract templates when the Accept block
 * only stores {@link AgreementBlock.contractTemplateId} (no {@link AgreementBlock.legalHtml} snapshot).
 */
export async function hydrateAgreementBlocksInDocument(
  document: ProposalDocument,
  organizationId: string,
): Promise<ProposalDocument> {
  const ids = new Set<string>();
  for (const block of document.blocks) {
    if (block.type === "agreement" && agreementBlockNeedsContractHydration(block as AgreementBlock)) {
      ids.add(block.contractTemplateId!.trim());
    }
  }
  if (ids.size === 0) return document;

  const templates = await getContractTemplatesForOrgByIds(organizationId, [...ids]);
  const byId = new Map(templates.map((t) => [t.id, t]));

  let changed = false;
  const blocks: ProposalBlock[] = document.blocks.map((block) => {
    if (block.type !== "agreement") return block;
    const ab = block as AgreementBlock;
    if (!agreementBlockNeedsContractHydration(ab)) return block;
    const record = byId.get(ab.contractTemplateId!.trim());
    if (!record) return block;
    changed = true;
    const snapshot = contractTemplateToAgreementSnapshot(record);
    return applyContractTemplateSnapshotToAgreementBlock(ab, snapshot, record);
  });

  return changed ? { ...document, blocks } : document;
}
