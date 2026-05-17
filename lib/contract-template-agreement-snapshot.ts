import {
  contractTemplateDocumentToHtml,
  contractTemplateRecordToDocument,
} from "@/lib/contract-template-document";
import type { ContractTemplateRecord } from "@/types/contract-template";
import type { AgreementBlock } from "@/types/proposal";

export type ContractTemplateAgreementSnapshot = {
  agreementTitle: string;
  introHtml?: string;
  legalHtml: string;
};

/** Intro + legal HTML for agreement modals — prefers stored HTML, else derives from block document. */
export function contractTemplateToAgreementSnapshot(
  record: ContractTemplateRecord,
): ContractTemplateAgreementSnapshot {
  if (record.legalHtml?.trim()) {
    return {
      agreementTitle: record.agreementTitle?.trim() || "Services Agreement",
      introHtml: record.introHtml?.trim() || undefined,
      legalHtml: record.legalHtml.trim(),
    };
  }

  const doc = contractTemplateRecordToDocument(record);
  const { introHtml, legalHtml } = contractTemplateDocumentToHtml(doc);
  return {
    agreementTitle: record.agreementTitle?.trim() || doc.title?.trim() || "Services Agreement",
    introHtml,
    legalHtml,
  };
}

export function agreementBlockNeedsContractHydration(block: AgreementBlock): boolean {
  return Boolean(block.contractTemplateId?.trim()) && !block.legalHtml?.trim();
}

export function applyContractTemplateSnapshotToAgreementBlock(
  block: AgreementBlock,
  snapshot: ContractTemplateAgreementSnapshot,
  record: ContractTemplateRecord,
): AgreementBlock {
  return {
    ...block,
    contractTemplateLabel: block.contractTemplateLabel?.trim() || record.name?.trim() || undefined,
    agreementTitle: block.agreementTitle?.trim() || snapshot.agreementTitle,
    introHtml: block.introHtml?.trim() ? block.introHtml : snapshot.introHtml,
    legalHtml: snapshot.legalHtml.trim() ? snapshot.legalHtml : block.legalHtml,
  };
}
