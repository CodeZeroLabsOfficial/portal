export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export interface InvoiceRecord {
  id: string;
  stripeInvoiceId: string;
  customerId: string;
  organizationId?: string;
  status: InvoiceStatus;
  currency: string;
  amountDue: number;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  /** Epoch millis — Firestore `issuedAt` (legacy: `issuedAtMs`). */
  issuedAt: number;
  /** Epoch millis — Firestore `paidAt` (legacy: `paidAtMs`). */
  paidAt?: number;
}
