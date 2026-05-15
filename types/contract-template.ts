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
  introHtml?: string;
  legalHtml: string;
  createdAt: number;
  updatedAt: number;
}
