import { z } from "zod";
import {
  PROPOSAL_COLUMN_FR_MAX,
  PROPOSAL_COLUMN_FR_MIN,
  normalizeColumnFlexForStorage,
} from "@/lib/proposal-columns";
import { normalizePackagesTotalSectionLabelForPersistence } from "@/lib/proposal-packages-totals";
import { escapeHtml } from "@/lib/escape-html";
import type { ProposalBlock, ProposalContentBlock, ProposalDocument, SectionBackground } from "@/types/proposal";

const idSchema = z.string().min(4);

const headerBlockSchema = z.object({
  id: idSchema,
  type: z.literal("header"),
  text: z.string().default(""),
  html: z.string().optional(),
});

const textBlockSchema = z.object({
  id: idSchema,
  type: z.literal("text"),
  html: z.string().optional(),
  body: z.string().optional(),
  editorMinHeightPx: z.number().finite().int().min(48).max(2000).optional(),
});

const imageBlockSchema = z.object({
  id: idSchema,
  type: z.literal("image"),
  url: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

const videoBlockSchema = z.object({
  id: idSchema,
  type: z.literal("video"),
  url: z.string().min(1),
  title: z.string().optional(),
});

const pricingLineSchema = z.object({
  id: idSchema,
  label: z.string().default(""),
  unitAmountMinor: z.number().finite(),
  quantity: z.number().finite().min(0).optional(),
  optional: z.boolean().optional(),
  serviceId: z.string().trim().min(1).optional(),
  unitAmount12Minor: z.number().finite().min(0).optional(),
  unitAmount24Minor: z.number().finite().min(0).optional(),
});

/** Reasonable colour string (allow any short CSS colour ≤ 32 chars). */
const colorString = z.string().trim().min(3).max(32);

const blockStyleSchema = z.object({
  variant: z.enum(["visual", "simple"]).optional(),
  primaryColor: colorString.optional(),
  highlightColor: colorString.optional(),
});

const relaxedUrl = z.string().max(8192).optional();

const sectionBackgroundSchema = z.object({
  kind: z.enum(["color", "image", "video"]),
  color: colorString.optional(),
  mediaUrl: relaxedUrl,
  posterUrl: relaxedUrl,
  tintColor: colorString.optional(),
  tintStyle: z.enum(["normal", "blend"]).optional(),
  tintOpacity: z.number().finite().min(0).max(100).optional(),
  blurStrength: z.number().finite().min(0).max(24).optional(),
  contentCard: z.boolean().optional(),
});

const splashFocalSchema = z.object({
  x: z.number().finite().min(0).max(100),
  y: z.number().finite().min(0).max(100),
});

const splashBackgroundSchema = z.object({
  type: z.enum(["image", "video", "color"]),
  url: relaxedUrl,
  videoUrl: relaxedUrl,
  color: colorString.optional(),
  focalPoint: splashFocalSchema.optional(),
  tintColor: colorString.optional(),
  tintOpacity: z.number().finite().min(0).max(100).optional(),
  tintMode: z.enum(["normal", "blend"]).optional(),
  blur: z.number().finite().min(0).max(24).optional(),
  posterUrl: relaxedUrl,
});

const splashHeightSchema = z.union([
  z.literal("full"),
  z.literal("half"),
  z.literal("third"),
  z.object({
    custom: z.number().finite().positive().max(2400),
    unit: z.enum(["px", "vh"]),
  }),
]);

const splashAlignmentSchema = z.object({
  vertical: z.enum(["top", "center", "bottom"]),
  horizontal: z.enum(["left", "center", "right"]),
});

const splashBlockSchema = z.object({
  id: idSchema,
  type: z.literal("splash"),
  background: splashBackgroundSchema,
  height: splashHeightSchema,
  alignment: splashAlignmentSchema,
  logoAlignment: splashAlignmentSchema.optional(),
  showLogo: z.boolean().optional(),
  logoSize: z.enum(["sm", "md", "lg", "xl"]).optional(),
  html: z.string().optional(),
  body: z.string().optional(),
  showCard: z.boolean().optional(),
  cardOpacity: z.number().finite().min(0).max(100).optional(),
});

const pricingBlockSchema = z.object({
  id: idSchema,
  type: z.literal("pricing"),
  currency: z.string().min(1).default("aud"),
  lineItems: z.array(pricingLineSchema).default([]),
  allowQuantityEdit: z.boolean().optional(),
  title: z.string().optional(),
  totalMinorUnits: z.number().finite().optional(),
  style: blockStyleSchema.optional(),
  quantityUnitLabel: z.string().min(1).max(40).optional(),
});

function nonNegInt(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

/** Migrate legacy monthly/yearly tier pricing → 12mo / 24mo monthly costs + entitlements. */
function normalizePackageTierInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const features = Array.isArray(o.features)
    ? o.features.filter((x): x is string => typeof x === "string")
    : [];

  const hasNew =
    typeof o.monthlyCost12Minor === "number" &&
    typeof o.monthlyCost24Minor === "number";

  let monthlyCost12Minor: number;
  let monthlyCost24Minor: number;
  if (hasNew) {
    monthlyCost12Minor = Math.max(0, Number(o.monthlyCost12Minor));
    monthlyCost24Minor = Math.max(0, Number(o.monthlyCost24Minor));
  } else {
    const m12 =
      typeof o.monthlyAmountMinor === "number" && Number.isFinite(o.monthlyAmountMinor)
        ? Math.max(0, o.monthlyAmountMinor)
        : 0;
    const y =
      typeof o.yearlyAmountMinor === "number" && Number.isFinite(o.yearlyAmountMinor)
        ? Math.max(0, o.yearlyAmountMinor)
        : 0;
    monthlyCost12Minor = m12;
    monthlyCost24Minor = y > 0 ? Math.round(y / 12) : m12;
  }

  /** Build the tier with optional fields conditionally so we never persist
   *  explicit `undefined` keys (which Firestore rejects unless
   *  `ignoreUndefinedProperties` is set). */
  const tier: Record<string, unknown> = {
    id: o.id,
    name: typeof o.name === "string" ? o.name : "",
    includedUsers: nonNegInt(o.includedUsers),
    includedLocations: nonNegInt(o.includedLocations),
    includedAdmins: nonNegInt(o.includedAdmins),
    monthlyCost12Minor,
    monthlyCost24Minor,
    features,
  };
  if (o.recommended === true) tier.recommended = true;
  if (typeof o.upfrontCost12Minor === "number" && o.upfrontCost12Minor >= 0) {
    tier.upfrontCost12Minor = o.upfrontCost12Minor;
  }
  if (typeof o.stripePriceId === "string") {
    const sp = o.stripePriceId.trim();
    if (sp.length > 0) tier.stripePriceId = sp.slice(0, 120);
  }
  if (typeof o.stripeProductId === "string") {
    const pr = o.stripeProductId.trim();
    if (pr.length > 0) tier.stripeProductId = pr.slice(0, 120);
  }
  if (typeof o.serviceId === "string") {
    const sid = o.serviceId.trim();
    if (sid.length > 0) tier.serviceId = sid.slice(0, 120);
  }
  return tier;
}

function normalizeAddonLineItemInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.length >= 4 ? o.id : undefined;
  if (!id) return null;
  const row: Record<string, unknown> = {
    id,
    label: typeof o.label === "string" ? o.label : "",
    unitAmountMinor:
      typeof o.unitAmountMinor === "number" && Number.isFinite(o.unitAmountMinor)
        ? Math.max(0, Math.round(o.unitAmountMinor))
        : 0,
  };
  if (typeof o.quantity === "number" && Number.isFinite(o.quantity) && o.quantity >= 0) {
    row.quantity = Math.floor(o.quantity);
  }
  if (o.optional === true) row.optional = true;
  const serviceId = typeof o.serviceId === "string" ? o.serviceId.trim() : "";
  if (serviceId) row.serviceId = serviceId;
  if (typeof o.unitAmount12Minor === "number" && Number.isFinite(o.unitAmount12Minor)) {
    row.unitAmount12Minor = Math.max(0, Math.round(o.unitAmount12Minor));
  }
  if (typeof o.unitAmount24Minor === "number" && Number.isFinite(o.unitAmount24Minor)) {
    row.unitAmount24Minor = Math.max(0, Math.round(o.unitAmount24Minor));
  }
  return row;
}

function normalizePackagesBlockInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  if (o.type !== "packages") return raw;
  const tiers = Array.isArray(o.tiers) ? o.tiers.map(normalizePackageTierInput) : [];

  /** Spread the source first, then strip optional fields we want to manage
   *  explicitly so they never end up as `undefined` keys on the output. */
  const block: Record<string, unknown> = { ...o, tiers };
  delete block.plan12Label;
  delete block.plan24Label;
  delete block.monthlyLabel;
  delete block.yearlyLabel;

  const plan12 =
    typeof o.plan12Label === "string"
      ? o.plan12Label
      : typeof o.monthlyLabel === "string"
        ? o.monthlyLabel
        : undefined;
  const plan24 =
    typeof o.plan24Label === "string"
      ? o.plan24Label
      : typeof o.yearlyLabel === "string"
        ? o.yearlyLabel
        : undefined;
  if (plan12) block.plan12Label = plan12;
  if (plan24) block.plan24Label = plan24;

  if (Array.isArray(o.addonLineItems)) {
    const lines = o.addonLineItems
      .map(normalizeAddonLineItemInput)
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof (x as Record<string, unknown>).id === "string"));
    if (lines.length > 0) block.addonLineItems = lines;
  }

  if (typeof o.addonsTitle === "string" && o.addonsTitle.trim()) block.addonsTitle = o.addonsTitle.trim();
  if (o.allowAddonQuantityEdit === false) block.allowAddonQuantityEdit = false;
  if (typeof o.addonQuantityUnitLabel === "string" && o.addonQuantityUnitLabel.trim()) {
    block.addonQuantityUnitLabel = o.addonQuantityUnitLabel.trim().slice(0, 40);
  }
  delete block.totalSectionLabel;
  const totalSectionLabel = normalizePackagesTotalSectionLabelForPersistence(o.totalSectionLabel);
  if (totalSectionLabel !== undefined) block.totalSectionLabel = totalSectionLabel;
  if (o.addonsSectionEnabled === true) block.addonsSectionEnabled = true;
  if (o.addonsSectionEnabled === false) block.addonsSectionEnabled = false;

  if (o.background && typeof o.background === "object") {
    const bgSafe = sectionBackgroundSchema.safeParse(o.background);
    if (bgSafe.success) {
      block.background = bgSafe.data;
    } else {
      delete block.background;
    }
  } else {
    delete block.background;
  }

  return block;
}

const packageTierSchema = z.object({
  id: idSchema,
  name: z.string().default(""),
  recommended: z.boolean().optional(),
  includedUsers: z.number().finite().int().min(0),
  includedLocations: z.number().finite().int().min(0),
  includedAdmins: z.number().finite().int().min(0),
  monthlyCost12Minor: z.number().finite().min(0),
  monthlyCost24Minor: z.number().finite().min(0),
  upfrontCost12Minor: z.number().finite().min(0).optional(),
  /** Stripe recurring Price id for this tier (optional). */
  stripePriceId: z.string().min(3).max(120).optional(),
  /** Stripe Product id — durations resolved like Add subscription (optional). */
  stripeProductId: z.string().min(3).max(120).optional(),
  /** Portal service catalogue id (preferred). */
  serviceId: z.string().min(1).max(120).optional(),
  features: z.array(z.string()).default([]),
});

const packagesBlockSchema = z.object({
  id: idSchema,
  type: z.literal("packages"),
  currency: z.string().min(1).default("aud"),
  title: z.string().optional(),
  titleHtml: z.string().optional(),
  plan12Label: z.string().optional(),
  plan24Label: z.string().optional(),
  tiers: z.array(packageTierSchema).default([]),
  style: blockStyleSchema.optional(),
  addonLineItems: z.array(pricingLineSchema).optional(),
  addonsTitle: z.string().optional(),
  allowAddonQuantityEdit: z.boolean().optional(),
  addonQuantityUnitLabel: z.string().min(1).max(40).optional(),
  totalSectionLabel: z.string().max(120).optional(),
  addonsSectionEnabled: z.boolean().optional(),
  background: sectionBackgroundSchema.optional(),
});

const formFieldSchema = z.object({
  id: idSchema,
  label: z.string().default(""),
  fieldType: z.enum(["text", "email", "textarea", "select"]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

const formBlockSchema = z.object({
  id: idSchema,
  type: z.literal("form"),
  fields: z.array(formFieldSchema).default([]),
  submitLabel: z.string().optional(),
  storeLocallyOnAccept: z.boolean().optional(),
});

const signatureBlockSchema = z.object({
  id: idSchema,
  type: z.literal("signature"),
  title: z.string().optional(),
  signerLabel: z.string().optional(),
  requirePrintedName: z.boolean().optional(),
  requireAcceptTerms: z.boolean().optional(),
  termsSummary: z.string().optional(),
});

const embedBlockSchema = z.object({
  id: idSchema,
  type: z.literal("embed"),
  url: z.string().min(1),
  title: z.string().optional(),
  aspectRatio: z.enum(["16:9", "4:3", "auto"]).optional(),
});

const paymentBlockSchema = z.object({
  id: idSchema,
  type: z.literal("payment"),
  label: z.string().optional(),
  stripePriceId: z.string().optional(),
});

const dividerBlockSchema = z.object({
  id: idSchema,
  type: z.literal("divider"),
});

const spacerBlockSchema = z.object({
  id: idSchema,
  type: z.literal("spacer"),
  heightPx: z.number().finite().min(1).max(2400).default(40),
});

const accordionPanelSchema = z.object({
  id: idSchema,
  title: z.string().default(""),
  titleHtml: z.string().optional(),
  html: z.string().optional(),
  body: z.string().optional(),
});

const accordionBlockSchema = z.object({
  id: idSchema,
  type: z.literal("accordion"),
  panels: z.array(accordionPanelSchema).default([]),
});

const iconBlockSchema = z.object({
  id: idSchema,
  type: z.literal("icon"),
  iconName: z.string().max(64).optional(),
  emoji: z.string().max(8).optional(),
  label: z.string().optional(),
  labelHtml: z.string().optional(),
});

function newAgreementMigrationChildId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `blk_${Math.random().toString(36).slice(2, 12)}`;
}

/** Migrates legacy `heading` into a header child; ensures `children` is an array. */
function normalizeAgreementBlockInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  if (o.type !== "agreement") return raw;
  const headingLegacy = typeof o.heading === "string" ? o.heading.trim() : "";
  let children = Array.isArray(o.children) ? [...o.children] : [];
  if (children.length === 0 && headingLegacy) {
    children = [
      {
        id: newAgreementMigrationChildId(),
        type: "header",
        text: headingLegacy,
        html: `<h2>${escapeHtml(headingLegacy)}</h2>`,
      },
    ];
  }
  const next: Record<string, unknown> = { ...o, children };
  delete next.heading;
  return next;
}

const agreementBlockSchema: z.ZodTypeAny = z.object({
  id: idSchema,
  type: z.literal("agreement"),
  contractTemplateId: z.string().max(128).optional(),
  contractTemplateLabel: z.string().max(200).optional(),
  buttonLabel: z.string().max(80).optional(),
  buttonAlign: z.enum(["start", "center"]).optional(),
  agreementTitle: z.string().max(200).optional(),
  introHtml: z.string().max(20_000).optional(),
  legalHtml: z.string().max(120_000).optional(),
  eSignaturesEnabled: z.boolean().optional(),
  prefillSignerNameEnabled: z.boolean().optional(),
  prefillSignerEmailEnabled: z.boolean().optional(),
  prefillSignerOrganizationEnabled: z.boolean().optional(),
  prefillSignerName: z.string().max(200).optional(),
  prefillSignerEmail: z.string().max(320).optional(),
  prefillSignerOrganization: z.string().max(500).optional(),
  electronicSignatureDisclaimerEnabled: z.boolean().optional(),
  termsReadDisclaimerEnabled: z.boolean().optional(),
  requireAcceptTerms: z.boolean().optional(),
  paymentDetailsSectionEnabled: z.boolean().optional(),
  subscriptionStartDateMode: z
    .enum(["on_acceptance", "delay_1_day", "delay_1_week", "delay_1_month", "custom"])
    .optional(),
  subscriptionStartCustomDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  style: blockStyleSchema.optional(),
  background: sectionBackgroundSchema.optional(),
  /** Lazy so this object exists in unions before `agreementNestedBlockSchema` is defined. */
  children: z.lazy(() => z.array(agreementNestedBlockSchema)).default([]),
});

/** Blocks allowed inside each column pane (cannot nest columns or accordion). */
const columnInnerUnionSchema = z.discriminatedUnion(
  "type",
  [
    headerBlockSchema,
    textBlockSchema,
    imageBlockSchema,
    videoBlockSchema,
    pricingBlockSchema,
    packagesBlockSchema,
    formBlockSchema,
    signatureBlockSchema,
    agreementBlockSchema,
    embedBlockSchema,
    paymentBlockSchema,
    dividerBlockSchema,
    spacerBlockSchema,
    iconBlockSchema,
  ] as unknown as [z.ZodDiscriminatedUnionOption<"type">, ...z.ZodDiscriminatedUnionOption<"type">[]],
);

const columnInnerSchema = z.preprocess((raw) => {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (r.type === "packages") {
      return normalizePackagesBlockInput(raw);
    }
    if (r.type === "agreement") {
      return normalizeAgreementBlockInput(raw);
    }
  }
  return raw;
}, columnInnerUnionSchema);

/** Reverses Firestore column encoding (`[{ blocks }]`) back to in-memory `Block[][]`. */
function unwrapColumnStacksFromFirestore(stacksRaw: unknown): unknown {
  if (!Array.isArray(stacksRaw) || stacksRaw.length === 0) {
    return stacksRaw;
  }
  const first = stacksRaw[0];
  const isFirestoreCell =
    first !== null &&
    typeof first === "object" &&
    !Array.isArray(first) &&
    "blocks" in first &&
    Array.isArray((first as { blocks: unknown }).blocks);
  if (!isFirestoreCell) {
    return stacksRaw;
  }
  return stacksRaw.map((cell) => {
    const c = cell as { blocks?: unknown };
    return Array.isArray(c.blocks) ? c.blocks : [];
  });
}

function normalizeColumnsBlockInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  if (o.type !== "columns") return raw;

  let stacksUnknown: unknown[] = [];
  if (Array.isArray(o.stacks)) {
    const unwrapped = unwrapColumnStacksFromFirestore(o.stacks);
    stacksUnknown = Array.isArray(unwrapped)
      ? unwrapped.map((cell) => (Array.isArray(cell) ? cell : []))
      : [];
  } else {
    const left = Array.isArray(o.left) ? o.left : [];
    const right = Array.isArray(o.right) ? o.right : [];
    stacksUnknown = [left, right];
  }

  while (stacksUnknown.length < 2) stacksUnknown.push([]);
  if (stacksUnknown.length > 4) {
    const head = stacksUnknown.slice(0, 3);
    const tail = stacksUnknown.slice(3).flat();
    stacksUnknown = [...head, tail];
  }

  let columnFlexParsed: number[] | undefined;
  if (Array.isArray(o.columnFlex)) {
    const nums = o.columnFlex.map((x) => {
      if (typeof x === "number" && Number.isFinite(x)) return x;
      const n = typeof x === "string" ? Number(x) : Number.NaN;
      return n;
    });
    if (nums.every((n) => typeof n === "number" && Number.isFinite(n))) {
      columnFlexParsed = normalizeColumnFlexForStorage(stacksUnknown.length, nums);
    }
  }

  const gapRaw = o.columnGap;
  const columnGapParsed =
    gapRaw === "compact" || gapRaw === "normal" || gapRaw === "relaxed" ? gapRaw : undefined;

  const alignRaw = o.rowAlign;
  const rowAlignParsed =
    alignRaw === "start" || alignRaw === "center" || alignRaw === "end" || alignRaw === "stretch"
      ? alignRaw
      : undefined;

  let insetPaddingParsed: number | undefined;
  if (typeof o.insetPaddingPx === "number" && Number.isFinite(o.insetPaddingPx)) {
    insetPaddingParsed = Math.round(Math.min(64, Math.max(0, o.insetPaddingPx)));
  }

  return {
    id: o.id,
    type: "columns",
    stacks: stacksUnknown,
    ...(columnFlexParsed ? { columnFlex: columnFlexParsed } : {}),
    ...(columnGapParsed ? { columnGap: columnGapParsed } : {}),
    ...(rowAlignParsed ? { rowAlign: rowAlignParsed } : {}),
    ...(insetPaddingParsed !== undefined && insetPaddingParsed > 0 ? { insetPaddingPx: insetPaddingParsed } : {}),
  };
}

const columnsBlockSchema = z.object({
  id: idSchema,
  type: z.literal("columns"),
  stacks: z.array(z.array(columnInnerSchema)).min(2).max(4),
  columnFlex: z
    .array(z.number().finite().min(PROPOSAL_COLUMN_FR_MIN).max(PROPOSAL_COLUMN_FR_MAX))
    .optional(),
  columnGap: z.enum(["compact", "normal", "relaxed"]).optional(),
  rowAlign: z.enum(["start", "center", "end", "stretch"]).optional(),
  insetPaddingPx: z.number().int().min(0).max(64).optional(),
});

/** Blocks inside an Accept block — same as section contents except no nested `agreement`. */
const agreementNestedBlockUnionSchema = z.discriminatedUnion(
  "type",
  [
    splashBlockSchema,
    headerBlockSchema,
    textBlockSchema,
    imageBlockSchema,
    videoBlockSchema,
    pricingBlockSchema,
    packagesBlockSchema,
    formBlockSchema,
    signatureBlockSchema,
    embedBlockSchema,
    paymentBlockSchema,
    dividerBlockSchema,
    spacerBlockSchema,
    accordionBlockSchema,
    columnsBlockSchema,
    iconBlockSchema,
  ] as unknown as [z.ZodDiscriminatedUnionOption<"type">, ...z.ZodDiscriminatedUnionOption<"type">[]],
);

const agreementNestedBlockSchema = z.preprocess((raw) => {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (r.type === "packages") {
      return normalizePackagesBlockInput(raw);
    }
    if (r.type === "columns") {
      return normalizeColumnsBlockInput(raw);
    }
  }
  return raw;
}, agreementNestedBlockUnionSchema);

/** Blocks inside a section — same as top-level except no nested `section`. */
const nestedBlockUnionSchema = z.discriminatedUnion(
  "type",
  [
    splashBlockSchema,
    headerBlockSchema,
    textBlockSchema,
    imageBlockSchema,
    videoBlockSchema,
    pricingBlockSchema,
    packagesBlockSchema,
    formBlockSchema,
    signatureBlockSchema,
    agreementBlockSchema,
    embedBlockSchema,
    paymentBlockSchema,
    dividerBlockSchema,
    spacerBlockSchema,
    accordionBlockSchema,
    columnsBlockSchema,
    iconBlockSchema,
  ] as unknown as [z.ZodDiscriminatedUnionOption<"type">, ...z.ZodDiscriminatedUnionOption<"type">[]],
);

const nestedBlockSchema = z.preprocess((raw) => {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (r.type === "packages") {
      return normalizePackagesBlockInput(raw);
    }
    if (r.type === "columns") {
      return normalizeColumnsBlockInput(raw);
    }
    if (r.type === "agreement") {
      return normalizeAgreementBlockInput(raw);
    }
  }
  return raw;
}, nestedBlockUnionSchema);

const sectionBlockSchema = z.object({
  id: idSchema,
  type: z.literal("section"),
  children: z.array(nestedBlockSchema).default([]),
  style: blockStyleSchema.optional(),
  background: sectionBackgroundSchema.optional(),
});

const blockUnionSchema = z.discriminatedUnion(
  "type",
  [
    splashBlockSchema,
    headerBlockSchema,
    textBlockSchema,
    imageBlockSchema,
    videoBlockSchema,
    pricingBlockSchema,
    packagesBlockSchema,
    formBlockSchema,
    signatureBlockSchema,
    agreementBlockSchema,
    embedBlockSchema,
    paymentBlockSchema,
    dividerBlockSchema,
    spacerBlockSchema,
    accordionBlockSchema,
    columnsBlockSchema,
    iconBlockSchema,
    sectionBlockSchema,
  ] as unknown as [z.ZodDiscriminatedUnionOption<"type">, ...z.ZodDiscriminatedUnionOption<"type">[]],
);

/** Migrates legacy packages / columns shapes before discriminatedUnion matching. */
const blockSchema = z.preprocess((raw) => {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (r.type === "packages") {
      return normalizePackagesBlockInput(raw);
    }
    if (r.type === "columns") {
      return normalizeColumnsBlockInput(raw);
    }
    if (r.type === "agreement") {
      return normalizeAgreementBlockInput(raw);
    }
  }
  return raw;
}, blockUnionSchema);

const documentSchema = z.object({
  title: z
    .string()
    .max(500)
    .transform((s) => (s.trim().length > 0 ? s.trim() : "Untitled proposal")),
  blocks: z.array(blockSchema),
});

export function parseProposalDocument(input: unknown): ProposalDocument {
  const fallbackTitle =
    input && typeof input === "object" && typeof (input as { title?: unknown }).title === "string"
      ? String((input as { title: string }).title).slice(0, 500)
      : "Untitled proposal";

  const parsed = documentSchema.safeParse(input);
  if (parsed.success) {
    return parsed.data as ProposalDocument;
  }

  /** Lenient path for legacy rows — normalize single blocks where possible. */
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const blocksUnknown = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks: ProposalBlock[] = [];
  for (let i = 0; i < blocksUnknown.length; i++) {
    const one = blockSchema.safeParse(blocksUnknown[i]);
    if (one.success) {
      blocks.push(one.data as ProposalBlock);
      continue;
    }
    const loose = blocksUnknown[i];
    if (loose && typeof loose === "object") {
      const o = loose as Record<string, unknown>;
      const id = typeof o.id === "string" && o.id.length >= 4 ? o.id : `legacy-${i}`;
      const type = typeof o.type === "string" ? o.type : "text";
      if (type === "text") {
        const rawMin = o.editorMinHeightPx;
        const editorMinHeightPx =
          typeof rawMin === "number" && Number.isFinite(rawMin)
            ? Math.min(2000, Math.max(48, Math.round(rawMin)))
            : undefined;
        blocks.push({
          id,
          type: "text",
          body: typeof o.body === "string" ? o.body : typeof o.html === "string" ? o.html : "",
          ...(editorMinHeightPx !== undefined ? { editorMinHeightPx } : {}),
        });
      } else if (type === "header") {
        blocks.push({
          id,
          type: "header",
          text: typeof o.text === "string" ? o.text : "",
          ...(typeof o.html === "string" ? { html: o.html } : {}),
        });
      } else if (type === "section") {
        const childrenRaw = Array.isArray(o.children) ? o.children : [];
        const children: ProposalContentBlock[] = [];
        for (const ch of childrenRaw) {
          const parsedChild = nestedBlockSchema.safeParse(ch);
          if (parsedChild.success) {
            children.push(parsedChild.data as ProposalContentBlock);
          }
        }
        const styleLoose = o.style;
        const styleSafe = blockStyleSchema.safeParse(styleLoose);
        let backgroundSafe: SectionBackground | undefined;
        if (o.background && typeof o.background === "object") {
          const bgSafe = sectionBackgroundSchema.safeParse(o.background);
          if (bgSafe.success) backgroundSafe = bgSafe.data as SectionBackground;
        }
        blocks.push({
          id,
          type: "section",
          children,
          ...(styleSafe.success &&
          (styleSafe.data.variant !== undefined ||
            styleSafe.data.primaryColor !== undefined ||
            styleSafe.data.highlightColor !== undefined)
            ? { style: styleSafe.data }
            : {}),
          ...(backgroundSafe ? { background: backgroundSafe } : {}),
        });
      } else {
        const candidate =
          type === "packages" ? normalizePackagesBlockInput({ ...o, id, type }) : { ...o, id, type };
        const retried = blockSchema.safeParse(candidate);
        if (retried.success) blocks.push(retried.data as ProposalBlock);
      }
    }
  }

  return {
    title: fallbackTitle || "Untitled proposal",
    blocks,
  };
}

export function assertProposalDocumentForSave(input: unknown): ProposalDocument {
  return parseProposalDocument(input);
}
