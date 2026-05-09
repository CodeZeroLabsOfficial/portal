import { z } from "zod";
import type { ProposalBlock, ProposalContentBlock, ProposalDocument } from "@/types/proposal";

const idSchema = z.string().min(4);

const headerBlockSchema = z.object({
  id: idSchema,
  type: z.literal("header"),
  text: z.string().default(""),
});

const textBlockSchema = z.object({
  id: idSchema,
  type: z.literal("text"),
  html: z.string().optional(),
  body: z.string().optional(),
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
});

/** Reasonable colour string (allow any short CSS colour ≤ 32 chars). */
const colorString = z.string().trim().min(3).max(32);

const blockStyleSchema = z.object({
  variant: z.enum(["visual", "simple"]).optional(),
  primaryColor: colorString.optional(),
  highlightColor: colorString.optional(),
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
  return tier;
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
  features: z.array(z.string()).default([]),
});

const packagesBlockSchema = z.object({
  id: idSchema,
  type: z.literal("packages"),
  currency: z.string().min(1).default("aud"),
  title: z.string().optional(),
  plan12Label: z.string().optional(),
  plan24Label: z.string().optional(),
  tiers: z.array(packageTierSchema).default([]),
  style: blockStyleSchema.optional(),
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

const accordionPanelSchema = z.object({
  id: idSchema,
  title: z.string().default(""),
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
  emoji: z.string().max(8).optional(),
  label: z.string().optional(),
});

/** Blocks allowed inside each column pane (cannot nest columns or accordion). */
const columnInnerUnionSchema = z.discriminatedUnion("type", [
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
  iconBlockSchema,
]);

const columnInnerSchema = z.preprocess((raw) => {
  if (raw && typeof raw === "object" && (raw as Record<string, unknown>).type === "packages") {
    return normalizePackagesBlockInput(raw);
  }
  return raw;
}, columnInnerUnionSchema);

const columnsBlockSchema = z.object({
  id: idSchema,
  type: z.literal("columns"),
  left: z.array(columnInnerSchema).default([]),
  right: z.array(columnInnerSchema).default([]),
});

/** Blocks inside a section — same as top-level except no nested `section`. */
const nestedBlockUnionSchema = z.discriminatedUnion("type", [
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
  accordionBlockSchema,
  columnsBlockSchema,
  iconBlockSchema,
]);

const nestedBlockSchema = z.preprocess((raw) => {
  if (raw && typeof raw === "object" && (raw as Record<string, unknown>).type === "packages") {
    return normalizePackagesBlockInput(raw);
  }
  return raw;
}, nestedBlockUnionSchema);

const sectionBlockSchema = z.object({
  id: idSchema,
  type: z.literal("section"),
  children: z.array(nestedBlockSchema).default([]),
  style: blockStyleSchema.optional(),
});

const blockUnionSchema = z.discriminatedUnion("type", [
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
  accordionBlockSchema,
  columnsBlockSchema,
  iconBlockSchema,
  sectionBlockSchema,
]);

/** Migrates legacy packages blocks before discriminatedUnion matching. */
const blockSchema = z.preprocess((raw) => {
  if (raw && typeof raw === "object" && (raw as Record<string, unknown>).type === "packages") {
    return normalizePackagesBlockInput(raw);
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
        blocks.push({
          id,
          type: "text",
          body: typeof o.body === "string" ? o.body : typeof o.html === "string" ? o.html : "",
        });
      } else if (type === "header") {
        blocks.push({
          id,
          type: "header",
          text: typeof o.text === "string" ? o.text : "",
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
