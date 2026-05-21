export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export interface InvoiceRecord {
  id: string;
  stripeInvoiceId: string;
  customerId: string;
  /** Stripe subscription id (`sub_…`) when invoice is tied to a subscription. */
  subscriptionId?: string;
  organizationId?: string;
  status: InvoiceStatus;
  currency: string;
  amountDue: number;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  /** Epoch millis — Firestore `issuedAt`. */
  issuedAt: number;
  /** Epoch millis — Firestore `paidAt`. */
  paidAt?: number;
}
