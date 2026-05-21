import type { SubscriptionStatus } from "./subscription";

/** CRM customer document in `customers/{customerId}` (Firestore). */
export type CustomerLifecycleStatus = "active" | "archived";

/** Unified CRM row type — leads promote to contacts without changing document id. */
export type CustomerCrmType = "lead" | "contact";

/** Subscription rollup for customer list — derived from Stripe-mirrored `subscriptions` rows. */
export type CustomerSubscriptionRollup = SubscriptionStatus | "none";

export interface CustomerRecord {
  id: string;
  /** Legacy multi-tenant field — optional; single-tenant CRM does not require it. */
  organizationId?: string;
  name: string;
  email: string;
  company?: string;
  /** Company switchboard / main line (distinct from contact `phone`). */
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyAbn?: string;
  companyAcn?: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  companyCity?: string;
  companyRegion?: string;
  companyPostalCode?: string;
  companyCountry?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  tags: string[];
  /** Arbitrary string map for industry-specific fields. */
  customFields: Record<string, string>;
  portalUserId?: string;
  stripeCustomerId?: string;
  /** Epoch millis — last successful Stripe link or profile resync from CRM. */
  stripeSyncedAt?: number;
  avatarUrl?: string;
  /** Defaults to `contact` when absent in Firestore (existing rows). */
  crmType: CustomerCrmType;
  /**
   * When true the row only carries company-level information used by the Accounts directory and
   * is hidden from the Customers directory. Contacts are not stored on these documents.
   */
  accountOnly?: boolean;
  status: CustomerLifecycleStatus;
  /** Epoch millis — Firestore `createdAt` (Timestamp or number). */
  createdAt: number;
  /** Epoch millis — Firestore `updatedAt` (Timestamp or number). */
  updatedAt: number;
  createdByUid?: string;
}

export type CustomerNoteKind = "note" | "call" | "email";

export interface CustomerNoteRecord {
  id: string;
  customerId: string;
  organizationId?: string;
  authorUid: string;
  body: string;
  kind: CustomerNoteKind;
  /** Epoch millis — Firestore `createdAt`. */
  createdAt: number;
}

export interface CustomerActivityRecord {
  id: string;
  customerId: string;
  organizationId?: string;
  type:
    | "created"
    | "updated"
    | "note"
    | "stripe_sync"
    | "auth_linked"
    | "archived"
    | "lead_converted"
    | "opportunity_created"
    | "other";
  title: string;
  detail?: string;
  actorUid?: string;
  /** Epoch millis — Firestore `createdAt`. */
  createdAt: number;
}
