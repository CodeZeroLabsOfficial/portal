import { z } from "zod";
import type { ProposalBlock, ProposalDocument } from "@/types/proposal";

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
  quantity: z.number().finite().positive().optional(),
  optional: z.boolean().optional(),
});

const pricingBlockSchema = z.object({
  id: idSchema,
  type: z.literal("pricing"),
  currency: z.string().min(1).default("aud"),
  lineItems: z.array(pricingLineSchema).default([]),
  allowQuantityEdit: z.boolean().optional(),
  title: z.string().optional(),
  totalMinorUnits: z.number().finite().optional(),
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

const blockSchema = z.discriminatedUnion("type", [
  headerBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  videoBlockSchema,
  pricingBlockSchema,
  formBlockSchema,
  signatureBlockSchema,
  embedBlockSchema,
  paymentBlockSchema,
  dividerBlockSchema,
]);

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
      } else {
        const retried = blockSchema.safeParse({ ...o, id, type });
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
