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
  | "agreement"
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
  /**
   * When `kind` is `video`, optional still image used as `<video poster>` and shown
   * on small viewports instead of motion (mobile fallback).
   */
  posterUrl?: string;
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
  /**
   * Minimum height (px) for the rich-text surface in editor + public view.
   * Set when the author drags the resize handle; omitted uses a compact default.
   */
  editorMinHeightPx?: number;
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
  /** Company logo in the top third of the splash (horizontal only; vertical is always `top`). */
  logoAlignment?: { vertical: "top" | "center" | "bottom"; horizontal: "left" | "center" | "right" };
  /** When false, hides template logo on this splash (first root splash only). Default: show when branding exists. */
  showLogo?: boolean;
  /** Logo scale on the first root splash. Default: `md`. */
  logoSize?: "sm" | "md" | "lg" | "xl";
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
  /** When set, the public viewer wraps the image in this link. */
  href?: string;
  /** Horizontal placement of the figure in the column (editor + public). */
  align?: "left" | "center" | "right";
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
  /** Portal service catalogue id — when set, label and unit price follow Services. */
  serviceId?: string;
  /** Per-month unit amount for 12-month plan term (catalogue add-ons). */
  unitAmount12Minor?: number;
  /** Per-month unit amount for 24-month plan term (catalogue add-ons). */
  unitAmount24Minor?: number;
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
  /**
   * Portal service catalogue id — preferred billing link (synced Stripe prices on activate).
   */
  serviceId?: string;
  /** Optional Stripe Price id for subscription after agreement (legacy single-price override). */
  stripePriceId?: string;
  /**
   * Optional Stripe Product id (`prod_…`) — legacy; use `serviceId` when possible.
   * The buyer’s 12 vs 24 month term picks the matching recurring price on that product.
   */
  stripeProductId?: string;
  /** Optional extra bullet points below the tier limits. */
  features: string[];
}

export interface PackagesBlock extends ProposalBlockBase {
  type: "packages";
  /** Optional full-bleed backdrop (same options as Section blocks). */
  background?: SectionBackground;
  currency: string;
  title?: string;
  /** Rich section heading (TipTap); public prefers this over {@link title} when set. */
  titleHtml?: string;
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
  /** Label for the packages summary bar (default: “Total”). */
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
  updatedAt: number;
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

/** How the Stripe subscription start date is derived when billing runs from an Accept block. */
export type AgreementSubscriptionStartDateMode =
  | "on_acceptance"
  | "delay_1_day"
  | "delay_1_week"
  | "delay_1_month"
  | "custom";

/**
 * Accept block: composable surface (like a section) plus a CTA that opens the
 * full-screen agreement modal. The modal aggregates plan + add-on selections and
 * legal copy from the attached contract template; signing calls the same
 * `acceptProposalPublicAction` as the legacy footer.
 */
export interface AgreementBlock extends ProposalBlockBase {
  type: "agreement";
  /**
   * When set, indicates agreement copy was last applied from this org contract template.
   * Modal title, intro, and legal HTML are snapshotted on the block when the template is chosen so proposals stay stable.
   */
  contractTemplateId?: string;
  /** Display name of {@link contractTemplateId} at attach time (optional, for editor hints). */
  contractTemplateLabel?: string;
  /** Layout + copy above the CTA — headings, text, columns, spacers, etc. (nested Accept blocks are not allowed). */
  children: ProposalAgreementChildBlock[];
  /** CTA button label (default: "View Agreement"). */
  buttonLabel?: string;
  /** Horizontal alignment of the CTA row (default: center). */
  buttonAlign?: "start" | "center";
  /** Modal header title — copied from the attached contract template (default in UI: "Services Agreement"). */
  agreementTitle?: string;
  /** Intro HTML above the legal body — copied from the attached contract template when present. */
  introHtml?: string;
  /**
   * Legal body HTML — copied from the attached contract template. When empty, the public modal uses built-in sections
   * (Parties, Scope, Pricing, Term, Termination, Confidentiality, Governing Law).
   */
  legalHtml?: string;
  /**
   * When false, the buyer can accept with name and email only (no drawn/typed/uploaded signature).
   * Default true.
   */
  eSignaturesEnabled?: boolean;
  /**
   * When true, the public agreement modal pre-fills the name from the CRM customer linked via
   * {@link ProposalRecord.customerId} (legacy {@link prefillSignerName} is used only if that customer is missing).
   */
  prefillSignerNameEnabled?: boolean;
  prefillSignerEmailEnabled?: boolean;
  prefillSignerOrganizationEnabled?: boolean;
  /** @deprecated Prefer CRM customer on the proposal; kept for older documents and editor preview fallback. */
  prefillSignerName?: string;
  /** @deprecated Prefer CRM customer on the proposal. */
  prefillSignerEmail?: string;
  /** @deprecated Prefer CRM customer on the proposal. */
  prefillSignerOrganization?: string;
  /**
   * When false, hides the “electronic signature is as valid as handwritten” acknowledgement
   * and does not require it. Default true.
   */
  electronicSignatureDisclaimerEnabled?: boolean;
  /**
   * When false, hides the “I have read and agree…” acknowledgement. Default true.
   */
  termsReadDisclaimerEnabled?: boolean;
  /**
   * When {@link termsReadDisclaimerEnabled}, controls whether that checkbox must be checked
   * before acceptance. Default true.
   */
  requireAcceptTerms?: boolean;
  /**
   * When false, the View Agreement modal does not show “Add payment details” or require a saved card,
   * even when the proposal has subscription billing. Acceptance is still recorded; subscription creation
   * from this flow is skipped. Default true.
   */
  paymentDetailsSectionEnabled?: boolean;
  /**
   * When a subscription is created from proposal acceptance, controls the Stripe schedule start date
   * relative to the acceptance date (or a fixed date when `custom`). Default `on_acceptance`.
   */
  subscriptionStartDateMode?: AgreementSubscriptionStartDateMode;
  /** `YYYY-MM-DD` (UTC) used when {@link subscriptionStartDateMode} is `custom`. */
  subscriptionStartCustomDate?: string;
  /**
   * Visual overrides — only `primaryColor` is honoured today and drives the
   * CTA button background (and matching modal sign button). Defaults to the
   * brand primary when unset.
   */
  style?: BlockStyle;
  /** Optional full-bleed backdrop behind the CTA (same options as Plans / Section blocks). */
  background?: SectionBackground;
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
  /** Rich panel title (TipTap); public prefers this over {@link title} when set. */
  titleHtml?: string;
  html?: string;
  body?: string;
}

export interface AccordionBlock extends ProposalBlockBase {
  type: "accordion";
  panels: AccordionPanel[];
}

export interface IconBlock extends ProposalBlockBase {
  type: "icon";
  /**
   * Lucide icon name from the proposal picker (e.g. `ArrowRight`).
   * When set, this is shown instead of {@link emoji}.
   */
  iconName?: string;
  /** @deprecated Legacy emoji-only content; preserved for older documents. */
  emoji?: string;
  label?: string;
  /** Rich caption (TipTap); public prefers this over {@link label} when set. */
  labelHtml?: string;
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
  | AgreementBlock
  | EmbedBlock
  | PaymentBlock
  | DividerBlock
  | SpacerBlock
  | IconBlock;

/** Horizontal gap between columns on medium+ viewports (editor + public). */
export type ColumnsBlockGapPreset = "compact" | "normal" | "relaxed";

/** Vertical alignment of each column stack within the row. */
export type ColumnsBlockRowAlign = "start" | "center" | "end" | "stretch";

/** Multi-column layout (2–4) — each stack holds column-safe blocks only. */
export interface ColumnsBlock extends ProposalBlockBase {
  type: "columns";
  /** Column stacks left-to-right; length 2–4. */
  stacks: ProposalColumnChildBlock[][];
  /**
   * Horizontal flex ratios for CSS `grid-template-columns` (same length as `stacks`).
   * Omitted → equal widths. Larger values consume more space relative to siblings.
   */
  columnFlex?: number[];
  /** Gap between columns; omitted → `normal` (matches legacy spacing). */
  columnGap?: ColumnsBlockGapPreset;
  /** Align column stacks vertically in the row; omitted → stretch. */
  rowAlign?: ColumnsBlockRowAlign;
  /** Uniform inset padding around the column row (px, 0–64). */
  insetPaddingPx?: number;
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
  | AgreementBlock
  | EmbedBlock
  | PaymentBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | AccordionBlock
  | IconBlock;

/** Blocks allowed inside an Accept (agreement) block — nested Accept blocks are not allowed. */
export type ProposalAgreementChildBlock = Exclude<ProposalContentBlock, AgreementBlock>;

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
  | AgreementBlock
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

export type ProposalStatus = "draft" | "published" | "viewed" | "accepted" | "declined" | "expired";

export interface ProposalBranding {
  logoUrl?: string;
  primaryColor?: string;
  fontFamily?: string;
}

/** CRM fields used to pre-fill agreement name / email / organisation on the public proposal page. */
export interface ProposalCustomerSignerPrefill {
  name: string;
  email: string;
  /** Company / organisation from the customer record. */
  organization: string;
}

export interface ProposalRecord {
  id: string;
  organizationId: string;
  createdByUid: string;
  title: string;
  /** Optional — links draft/published proposals to `customers/{customerId}`. */
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
  sentAt?: number;
  /** Public engagement (updated from analytics API). */
  viewCount?: number;
  totalEngagementSeconds?: number;
  lastViewedAt?: number;
  /** After explicit acceptance on the public page. */
  acceptedAt?: number;
  acceptedByName?: string;
  /** PNG data URL captured at acceptance when the buyer signs via the agreement modal. */
  acceptedSignatureDataUrl?: string;
  /** How the signature image was produced (`draw`, `type`, or `upload`). */
  acceptedSignatureMethod?: "draw" | "type" | "upload";
  /** Optional client clock at sign (ms); server `acceptedAt` remains authoritative. */
  acceptedClientSignedAt?: number;
  /** Stripe Checkout / PaymentIntent linkage when collecting payment in-proposal. */
  stripePaymentIntentId?: string;
  /** Customer choices from public viewer (e.g. selected package tier). Keyed by block id. */
  publicSelections?: ProposalPublicSelections;
  /** When created from a template (audit). */
  sourceTemplateId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Staff proposals hub row — account/contact labels from linked CRM customer. */
export type ProposalHubListRow = ProposalRecord & {
  accountCompanyName: string;
  contactName: string;
};
