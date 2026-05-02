/** CRM customer document in `customers/{customerId}` (Firestore). */
export type CustomerLifecycleStatus = "active" | "archived";

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
  organizationId: string;
  name: string;
  email: string;
  company?: string;
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
  status: CustomerLifecycleStatus;
  createdAtMs: number;
  updatedAtMs: number;
  createdByUid?: string;
}

export type CustomerNoteKind = "note" | "call" | "email";

export interface CustomerNoteRecord {
  id: string;
  customerId: string;
  organizationId: string;
  authorUid: string;
  body: string;
  kind: CustomerNoteKind;
  createdAtMs: number;
}

export interface CustomerActivityRecord {
  id: string;
  customerId: string;
  organizationId: string;
  type: "created" | "updated" | "note" | "stripe_sync" | "auth_linked" | "archived" | "other";
  title: string;
  detail?: string;
  actorUid?: string;
  createdAtMs: number;
}
