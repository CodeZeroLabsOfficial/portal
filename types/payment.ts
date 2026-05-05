/** PaymentIntent mirror row — synced from Stripe webhooks. */
export type PaymentIntentWebhookStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

export interface PaymentRecord {
  id: string;
  stripePaymentIntentId: string;
  /** Stripe Customer id (`cus_…`) when present. */
  customerId: string;
  organizationId?: string;
  currency: string;
  /** Amount intended / received in minor units (cents). */
  amount: number;
  status: PaymentIntentWebhookStatus | string;
  /** Optional description from metadata or invoice linkage. */
  description?: string;
  createdAtMs: number;
  updatedAtMs: number;
}
