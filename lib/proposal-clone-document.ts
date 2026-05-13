import { randomUUID } from "node:crypto";
import type {
  ColumnsBlock,
  FormBlock,
  FormField,
  PricingBlock,
  ProposalBlock,
  ProposalBranding,
  ProposalColumnChildBlock,
  ProposalContentBlock,
  ProposalDocument,
} from "@/types/proposal";

/** Deep-clone a proposal document with fresh block (and nested) ids so templates don’t share identities with instances. */
export function cloneProposalDocument(doc: ProposalDocument): ProposalDocument {
  return {
    title: doc.title,
    blocks: doc.blocks.map(cloneBlock),
  };
}

function cloneBlock(block: ProposalBlock): ProposalBlock {
  const id = randomUUID();
  switch (block.type) {
    case "header":
      return { ...block, id };
    case "text":
      return { ...block, id };
    case "splash":
      return { ...block, id };
    case "image":
      return { ...block, id };
    case "video":
      return { ...block, id };
    case "pricing": {
      const b = block as PricingBlock;
      return {
        ...b,
        id,
        lineItems: b.lineItems.map((li) => ({ ...li, id: randomUUID() })),
      };
    }
    case "packages":
      return {
        ...block,
        id,
        tiers: block.tiers.map((t) => ({
          ...t,
          id: randomUUID(),
        })),
      };
    case "form": {
      const b = block as FormBlock;
      return {
        ...b,
        id,
        fields: b.fields.map((f: FormField) => ({ ...f, id: randomUUID() })),
      };
    }
    case "signature":
      return { ...block, id };
    case "agreement":
      return { ...block, id };
    case "embed":
      return { ...block, id };
    case "payment":
      return { ...block, id };
    case "divider":
      return { ...block, id };
    case "spacer":
      return { ...block, id };
    case "accordion":
      return {
        ...block,
        id,
        panels: block.panels.map((p) => ({
          ...p,
          id: randomUUID(),
        })),
      };
    case "columns": {
      const c = block as ColumnsBlock;
      return {
        ...c,
        id,
        stacks: c.stacks.map((stack) =>
          stack.map((child) => cloneBlock(child as ProposalBlock) as ProposalColumnChildBlock),
        ),
      };
    }
    case "icon":
      return { ...block, id };
    case "section":
      return {
        ...block,
        id,
        children: block.children.map((c) => cloneBlock(c as ProposalBlock) as ProposalContentBlock),
      };
  }
}

/** Snapshot branding when copying template → proposal instance (best-effort). */
export function cloneBrandingFromTemplate(branding: ProposalBranding | undefined): ProposalBranding | undefined {
  if (!branding) return undefined;
  return { ...branding };
}
