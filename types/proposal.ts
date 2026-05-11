/** Discriminated proposal block payloads stored under `document.blocks`. */

export type ProposalBlockType =
  | "section"
  | "splash"
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
  | "divider"
  | "spacer"
  | "columns"
  | "accordion"
  | "icon";

export interface ProposalBlockBase {
  id: string;
  type: ProposalBlockType;
}

/**
 * Per-block visual style overrides. Consumed by Quote (pricing) and Plans (packages) on the
 * public page; only Plans exposes the editor “Style” picker on the block toolbar.
 */
export interface BlockStyle {
  /** Layout density / chrome. `visual` adds a hero container, `simple` is flat. */
  variant?: "visual" | "simple";
  /** Backdrop / hero accent (CSS colour, e.g. `#4543F7`). */
  primaryColor?: string;
  /** Highlight tone for the recommended tier / total row. */
  highlightColor?: string;
}

/** Full-bleed section backdrop (editable per section block). */
export type SectionBackdropKind = "color" | "image" | "video";

export interface SectionBackground {
  kind: SectionBackdropKind;
  /** Solid fill when `kind` is `color`. */
  color?: string;
  /** Image or looping video asset URL when `kind` is `image` | `video`. */
  mediaUrl?: string;
  /** Overlay tint. */
  tintColor?: string;
  tintStyle?: "normal" | "blend";
  /** 0–100 */
  tintOpacity?: number;
  /** 0–24 — blur applied only to raster / footage background layers. */
  blurStrength?: number;
  /** Optional frosted inset behind stacked content on top of the backdrop. */
  contentCard?: boolean;
}

export interface HeaderBlock extends ProposalBlockBase {
  type: "header";
  text: string;
  /** Rich heading (TipTap); when set, public view prefers this over `text`. */
  html?: string;
}

export interface TextBlock extends ProposalBlockBase {
  type: "text";
  /** Sanitized rich HTML from the editor. */
  html?: string;
  /** Plain fallback (legacy / import). */
  body?: string;
}

/** Hero / full-bleed backdrop configuration for splash blocks. */
export interface SplashBlockBackground {
  type: "image" | "video" | "color";
  /** Image URL when `type` is `image`, or optional poster when `type` is `video`. */
  url?: string;
  /** Video URL: YouTube, Vimeo, direct `.mp4` / WebM, etc. when `type` is `video`. */
  videoUrl?: string;
  /** Solid fill when `type` is `color`. */
  color?: string;
  /** Object-position percentages (0–100) for image / poster / video cover framing. */
  focalPoint?: { x: number; y: number };
  tintColor?: string;
  /** 0–100 */
  tintOpacity?: number;
  tintMode?: "normal" | "blend";
  /** 0–24 — blur on raster / self-hosted video layers only (embeds ignore blur). */
  blur?: number;
  /** Shown under text on small screens instead of motion, and as `<video poster>` when supported. */
  posterUrl?: string;
}

export type SplashBlockHeight =
  | "full"
  | "half"
  | "third"
  | { custom: number; unit: "px" | "vh" };

export interface SplashBlock extends ProposalBlockBase {
  type: "splash";
  background: SplashBlockBackground;
  height: SplashBlockHeight;
  alignment: { vertical: "top" | "center" | "bottom"; horizontal: "left" | "center" | "right" };
  /** Rich HTML (same pipeline as `TextBlock`). */
  html?: string;
  body?: string;
  showCard?: boolean;
  /** 0–100 — panel behind rich text when `showCard` is true. */
  cardOpacity?: number;
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
  /** Visual style overrides (variant + colours). */
  style?: BlockStyle;
  /** Suffix shown after quantity on public table (default in UI: “Unit”). */
  quantityUnitLabel?: string;
}

/** One selectable tier: term-based monthly pricing + included entitlements. */
export interface PackageTier {
  id: string;
  name: string;
  recommended?: boolean;
  includedUsers: number;
  includedLocations: number;
  includedAdmins: number;
  /** Recurring per-month amount (minor units) when the buyer chooses the 12-month term. */
  monthlyCost12Minor: number;
  /** Recurring per-month amount (minor units) when the buyer chooses the 24-month term. */
  monthlyCost24Minor: number;
  /** One-time upfront charge for the 12-month term only (minor units). */
  upfrontCost12Minor?: number;
  /** Optional extra bullet points below the tier limits. */
  features: string[];
}

export interface PackagesBlock extends ProposalBlockBase {
  type: "packages";
  currency: string;
  title?: string;
  /** Toggle label for the 12-month term (default in UI: “12 months”). */
  plan12Label?: string;
  /** Toggle label for the 24-month term (default in UI: “24 months”). */
  plan24Label?: string;
  tiers: PackageTier[];
  /** Visual style overrides (variant + colours). */
  style?: BlockStyle;
  /** Optional add-ons (same shape as pricing line items); each line is a per-month amount for the selected term. */
  addonLineItems?: PricingLineItem[];
  /** Title above the add-ons table (default in UI: “Add-ons”). */
  addonsTitle?: string;
  /** Let the recipient change add-on quantities on the public page. */
  allowAddonQuantityEdit?: boolean;
  /** Suffix after quantity in the add-ons table (default: “Unit”). */
  addonQuantityUnitLabel?: string;
  /** Label for the packages summary bar (default: “Monthly total”). */
  totalSectionLabel?: string;
  /**
   * When true, the add-ons table is shown in the builder and on the public page.
   * When false, the section is hidden (data may remain). Omitted: legacy blocks
   * show add-ons only if `addonLineItems` is non-empty.
   */
  addonsSectionEnabled?: boolean;
}

/** Persisted when the recipient selects a package on the public proposal. Keyed by block id. */
export interface PackagesPublicSelection {
  kind: "packages";
  tierId: string;
  term: "12_months" | "24_months";
  updatedAtMs: number;
  /** Buyer quantity overrides keyed by add-on line id. */
  addonQuantities?: Record<string, number>;
  /** Buyer opted out of optional add-ons keyed by line id. */
  addonOptionalOff?: Record<string, boolean>;
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

/** Vertical whitespace between blocks (public + preview). */
export interface SpacerBlock extends ProposalBlockBase {
  type: "spacer";
  /** Pixel height (1–2400). */
  heightPx: number;
}

export interface AccordionPanel {
  id: string;
  title: string;
  html?: string;
  body?: string;
}

export interface AccordionBlock extends ProposalBlockBase {
  type: "accordion";
  panels: AccordionPanel[];
}

export interface IconBlock extends ProposalBlockBase {
  type: "icon";
  /** Emoji / single-character marker shown in proposals. */
  emoji?: string;
  label?: string;
}

/** Column cells: same as nested section content excluding nested columns and accordion. */
export type ProposalColumnChildBlock =
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
  | DividerBlock
  | SpacerBlock
  | IconBlock;

/** Two-pane layout — each side holds column-safe blocks only. */
export interface ColumnsBlock extends ProposalBlockBase {
  type: "columns";
  left: ProposalColumnChildBlock[];
  right: ProposalColumnChildBlock[];
}

/** Blocks allowed inside a section (sections do not nest). */
export type ProposalContentBlock =
  | SplashBlock
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
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | AccordionBlock
  | IconBlock;

export interface SectionBlock extends ProposalBlockBase {
  type: "section";
  children: ProposalContentBlock[];
  /** Optional hero / layout styling (same shape as quote & plans blocks). */
  style?: BlockStyle;
  /** Optional cinematic backdrop beneath nested content. */
  background?: SectionBackground;
}

export type ProposalBlock =
  | SectionBlock
  | SplashBlock
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
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | AccordionBlock
  | IconBlock;

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
  /** When created from a proposal template (audit). */
  sourceTemplateId?: string;
  createdAtMs: number;
  updatedAtMs: number;
}
