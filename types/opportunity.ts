export type OpportunityStage =
  | "lead_in"
  | "discovery"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost";

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

/** Free-form note attached to a single opportunity; lives in `opportunity_notes/{noteId}`. */
export interface OpportunityNoteRecord {
  id: string;
  opportunityId: string;
  organizationId?: string;
  authorUid: string;
  body: string;
  /** Derived from Firestore `createdAt` (Timestamp) or legacy `createdAtMs`. */
  createdAtMs: number;
}

export type OpportunityActivityKind = "meeting" | "call" | "email" | "other";

/** Logged interaction (meeting, call, email, etc.); lives in `opportunity_activities/{id}`. */
export interface OpportunityActivityRecord {
  id: string;
  opportunityId: string;
  organizationId?: string;
  kind: OpportunityActivityKind;
  title: string;
  detail?: string;
  /** When the interaction took place. Derived from Firestore Timestamp or legacy ms. */
  occurredAtMs: number;
  authorUid: string;
  /** Derived from Firestore `createdAt` (Timestamp) or legacy `createdAtMs`. */
  createdAtMs: number;
}
