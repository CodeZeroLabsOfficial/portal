export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/** Denormalized subscription row synced from Stripe webhooks + Firestore rules for reads. */
export interface SubscriptionRecord {
  id: string;
  customerId: string;
  organizationId?: string;
  status: SubscriptionStatus;
  priceId?: string;
  productName?: string;
  currency: string;
  interval?: "month" | "year";
  currentPeriodEndMs?: number;
  cancelAtPeriodEnd?: boolean;
  /** Denormalized recurring amount in minor units (optional — used by dashboard heuristics). */
  mrrAmount?: number;
  updatedAtMs: number;
}
