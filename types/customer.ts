/** CRM customer document in `customers/{customerId}` (Firestore). */
export type CustomerLifecycleStatus = "active" | "archived";

/** Unified CRM row type — leads promote to contacts without changing document id. */
export type CustomerCrmType = "lead" | "contact";

/** Subscription rollup for profile header — derived from Stripe-mirrored `subscriptions` rows. */
export type CustomerSubscriptionRollup =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "mixed";

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
  avatarUrl?: string;
  /** Defaults to `contact` when absent in Firestore (existing rows). */
  crmType: CustomerCrmType;
  status: CustomerLifecycleStatus;
  /** Derived from Firestore `createdAt` (Timestamp) or legacy `createdAtMs`. */
  createdAtMs: number;
  /** Derived from Firestore `updatedAt` (Timestamp) or legacy `updatedAtMs`. */
  updatedAtMs: number;
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
  /** Derived from Firestore `createdAt` or legacy `createdAtMs`. */
  createdAtMs: number;
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
  /** Derived from Firestore `createdAt` or legacy `createdAtMs`. */
  createdAtMs: number;
}
