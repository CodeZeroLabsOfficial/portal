export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export type SubscriptionCollectionMethod = "charge_automatically" | "send_invoice";

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
  /** Normalized recurring amount per month (minor units), including from annual prices (÷12). */
  monthlyAmountMinor?: number;
  /** Stripe subscription.created */
  createdAtMs?: number;
  /** Stripe Subscription.collection_method */
  collectionMethod?: SubscriptionCollectionMethod;
  /** Stripe PaymentMethod.type when webhook payload includes expanded default_payment_method */
  defaultPaymentMethodType?: string;
  /** Denormalized recurring amount in minor units (optional — dashboard heuristics; month-interval lines only unless backfilled). */
  mrrAmount?: number;
  updatedAtMs: number;
}
