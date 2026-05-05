/** Discriminated proposal block payloads stored under `document.blocks`. */

export type ProposalBlockType =
  | "header"
  | "text"
  | "image"
  | "video"
  | "pricing"
  | "packages"
  | "embed"
  | "form"
  | "signature"
  | "payment"
  | "divider";

export interface ProposalBlockBase {
  id: string;
  type: ProposalBlockType;
}

export interface HeaderBlock extends ProposalBlockBase {
  type: "header";
  text: string;
}

export interface TextBlock extends ProposalBlockBase {
  type: "text";
  /** Sanitized rich HTML from the editor. */
  html?: string;
  /** Plain fallback (legacy / import). */
  body?: string;
}

export interface ImageBlock extends ProposalBlockBase {
  type: "image";
  url: string;
  alt?: string;
  caption?: string;
}

export interface VideoBlock extends ProposalBlockBase {
  type: "video";
  url: string;
  title?: string;
}

export interface PricingLineItem {
  id: string;
  label: string;
  unitAmountMinor: number;
  /** Default quantity for the public viewer. */
  quantity?: number;
  /** When true, buyer can toggle off (add-on). */
  optional?: boolean;
}

export interface PricingBlock extends ProposalBlockBase {
  type: "pricing";
  currency: string;
  lineItems: PricingLineItem[];
  /** Let the recipient change quantities on the public page. */
  allowQuantityEdit?: boolean;
  /** Optional title above the table. */
  title?: string;
  /** Legacy keys used by dashboard heuristics (optional). */
  totalMinorUnits?: number;
}

/** One selectable tier in a packages grid (monthly vs yearly unit pricing × quantity). */
export interface PackageTier {
  id: string;
  name: string;
  /** Unit price per billing month (minor units, e.g. cents). */
  monthlyAmountMinor: number;
  /** Optional strikethrough “was” price for monthly. */
  monthlyOriginalMinor?: number;
  /** Unit price per billing year (minor units). */
  yearlyAmountMinor: number;
  yearlyOriginalMinor?: number;
  recommended?: boolean;
  features: string[];
}

export interface PackagesBlock extends ProposalBlockBase {
  type: "packages";
  currency: string;
  title?: string;
  monthlyLabel?: string;
  yearlyLabel?: string;
  /** Shown on the yearly segment of the billing toggle (e.g. “20% OFF”). */
  yearlyBadgeText?: string;
  quantityLabel?: string;
  defaultQuantity?: number;
  tiers: PackageTier[];
}

/** Persisted when the recipient selects a package on the public proposal. Keyed by block id. */
export interface PackagesPublicSelection {
  kind: "packages";
  tierId: string;
  billing: "monthly" | "yearly";
  quantity: number;
  updatedAtMs: number;
}

export type ProposalPublicSelections = Record<string, PackagesPublicSelection>;

export type FormFieldType = "text" | "email" | "textarea" | "select";

export interface FormField {
  id: string;
  label: string;
  fieldType: FormFieldType;
  required?: boolean;
  options?: string[];
}

export interface FormBlock extends ProposalBlockBase {
  type: "form";
  fields: FormField[];
  submitLabel?: string;
  /** Client-side only until wired to workflow — responses stored in `formResponse` on accept. */
  storeLocallyOnAccept?: boolean;
}

export interface SignatureBlock extends ProposalBlockBase {
  type: "signature";
  title?: string;
  signerLabel?: string;
  requirePrintedName?: boolean;
  requireAcceptTerms?: boolean;
  termsSummary?: string;
}

export interface EmbedBlock extends ProposalBlockBase {
  type: "embed";
  url: string;
  title?: string;
  aspectRatio?: "16:9" | "4:3" | "auto";
}

export interface PaymentBlock extends ProposalBlockBase {
  type: "payment";
  label?: string;
  /** Future: Stripe Price or PaymentIntent id. */
  stripePriceId?: string;
}

export interface DividerBlock extends ProposalBlockBase {
  type: "divider";
}

export type ProposalBlock =
  | HeaderBlock
  | TextBlock
  | ImageBlock
  | VideoBlock
  | PricingBlock
  | PackagesBlock
  | FormBlock
  | SignatureBlock
  | EmbedBlock
  | PaymentBlock
  | DividerBlock;

export interface ProposalDocument {
  title: string;
  blocks: ProposalBlock[];
}

export type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";

export interface ProposalBranding {
  logoUrl?: string;
  primaryColor?: string;
  fontFamily?: string;
}

export interface ProposalRecord {
  id: string;
  organizationId: string;
  createdByUid: string;
  title: string;
  /** Optional — links draft/sent proposals to `customers/{customerId}`. */
  customerId?: string;
  /** Optional — links to `opportunities/{opportunityId}` when created from pipeline. */
  opportunityId?: string;
  /** Optional — when set, associates the proposal with a CRM / billing contact email. */
  recipientEmail?: string;
  status: ProposalStatus;
  /** Public share token for `/p/[token]` viewer — rotate on resend if needed. */
  shareToken: string;
  document: ProposalDocument;
  branding?: ProposalBranding;
  documentVersion?: number;
  /** PBKDF2 string from `hashSharePassword` — if set, public link requires password once per browser. */
  sharePasswordHash?: string;
  /** When the proposal was first sent to the client. */
  sentAtMs?: number;
  /** Public engagement (updated from analytics API). */
  viewCount?: number;
  totalEngagementSeconds?: number;
  lastViewedAtMs?: number;
  /** After explicit acceptance on the public page. */
  acceptedAtMs?: number;
  acceptedByName?: string;
  /** Stripe Checkout / PaymentIntent linkage when collecting payment in-proposal. */
  stripePaymentIntentId?: string;
  /** Customer choices from public viewer (e.g. selected package tier). Keyed by block id. */
  publicSelections?: ProposalPublicSelections;
  createdAtMs: number;
  updatedAtMs: number;
}
