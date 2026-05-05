import type { ProposalBranding, ProposalDocument } from "@/types/proposal";

/** Firestore `proposal_templates/{id}` — reusable starting point for CRM proposals. */
export interface ProposalTemplateRecord {
  id: string;
  organizationId: string;
  createdByUid: string;
  name: string;
  description?: string;
  document: ProposalDocument;
  branding?: ProposalBranding;
  createdAtMs: number;
  updatedAtMs: number;
}
