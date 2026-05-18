import type { ProposalDocument } from "@/types/proposal";
import type { ProposalTemplateStage } from "@/types/proposal-template";

/**
 * Firestore `contract_templates/{id}` — reusable legal copy for Accept (agreement) blocks.
 * Content is snapshotted onto each proposal block when attached so downstream documents stay stable.
 */
export interface ContractTemplateRecord {
  id: string;
  organizationId: string;
  createdByUid: string;
  name: string;
  description?: string;
  /** Default modal title when applied to an Accept block. */
  agreementTitle: string;
  /** Omitted in older documents — parsed as `published`. */
  stage: ProposalTemplateStage;
  /** Block-based body (preferred). Serialized to {@link introHtml} / {@link legalHtml} on save for agreement snapshots. */
  document?: ProposalDocument;
  introHtml?: string;
  legalHtml: string;
  createdAt: number;
  updatedAt: number;
}
