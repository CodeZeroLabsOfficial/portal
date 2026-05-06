export type OpportunityStage =
  | "qualification"
  | "discovery"
  | "proposal"
  | "negotiation"
  | "awaiting_signature"
  | "closed_won"
  | "closed_lost"
  | "onboarding";

/** `opportunities/{id}` — deal linked to a unified CRM customer (`customers/{customerId}`). */
export interface OpportunityRecord {
  id: string;
  customerId: string;
  organizationId?: string;
  name: string;
  stage: OpportunityStage;
  /** Deal size in minor units (e.g. cents), optional. */
  amountMinor?: number;
  currency: string;
  /** Snapshot of `customers.customFields` at creation or last explicit sync; displayed on proposals. */
  customFieldsSnapshot: Record<string, string>;
  notes?: string;
  createdAtMs: number;
  updatedAtMs: number;
  createdByUid?: string;
}
