import type { ProposalBranding, ProposalDocument } from "@/types/proposal";

/** Lifecycle for staff-facing template rows (CRM can still reference draft templates if desired). */
export type ProposalTemplateStage = "draft" | "published";

/** What the template is used for (list hub). */
export type ProposalTemplateType = "proposal" | "contract";

/** Firestore `proposal_templates/{id}` — reusable starting point for CRM proposals. */
export interface ProposalTemplateRecord {
  id: string;
  organizationId: string;
  createdByUid: string;
  name: string;
  description?: string;
  /** Omitted in older documents — parsed as `proposal`. */
  templateType: ProposalTemplateType;
  /** Omitted in older documents — parsed as `published` for backward compatibility. */
  stage: ProposalTemplateStage;
  document: ProposalDocument;
  branding?: ProposalBranding;
  createdAt: number;
  updatedAt: number;
}
