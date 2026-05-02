export type ProposalBlockType =
  | "header"
  | "text"
  | "image"
  | "video"
  | "pricing"
  | "embed"
  | "form"
  | "signature"
  | "payment"
  | "divider";

export interface ProposalBlockBase {
  id: string;
  type: ProposalBlockType;
}

export interface ProposalDocument {
  title: string;
  blocks: ProposalBlock[];
}

export type ProposalBlock = ProposalBlockBase & Record<string, unknown>;

export type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";

export interface ProposalRecord {
  id: string;
  organizationId: string;
  createdByUid: string;
  title: string;
  /** Optional — when set, associates the proposal with a CRM / billing contact email. */
  recipientEmail?: string;
  status: ProposalStatus;
  /** Public share token for `/p/[token]` viewer — rotate on resend if needed. */
  shareToken: string;
  document: ProposalDocument;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    fontFamily?: string;
  };
  /** Stripe Checkout / PaymentIntent linkage when collecting payment in-proposal. */
  stripePaymentIntentId?: string;
  createdAtMs: number;
  updatedAtMs: number;
}
