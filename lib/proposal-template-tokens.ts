import type { CustomerRecord } from "@/types/customer";
import type { OpportunityRecord } from "@/types/opportunity";
import type { ProposalDocument } from "@/types/proposal";

export interface ProposalTokenContext {
  customer: CustomerRecord;
  opportunity?: OpportunityRecord | null;
}

/** Replace `{{name}}`, `{{email}}`, `{{company}}`, `{{opportunity}}`, `{{deal_amount}}` in strings (case-insensitive). */
export function replaceProposalTokens(text: string, ctx: ProposalTokenContext): string {
  const { customer, opportunity } = ctx;
  const company = customer.company?.trim() ?? "";
  const oppName = opportunity?.name?.trim() ?? "";
  let dealAmount = "";
  if (opportunity && typeof opportunity.amountMinor === "number") {
    dealAmount = (opportunity.amountMinor / 100).toLocaleString(undefined, {
      style: "currency",
      currency: opportunity.currency.toUpperCase(),
    });
  }

  const vars: Record<string, string> = {
    name: customer.name?.trim() ?? "",
    email: customer.email?.trim() ?? "",
    company,
    opportunity: oppName,
    deal_amount: dealAmount,
  };

  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), value);
  }
  return out;
}

export function applyProposalTokensToDocument(doc: ProposalDocument, ctx: ProposalTokenContext): ProposalDocument {
  const title = replaceProposalTokens(doc.title, ctx);
  const blocks = doc.blocks.map((block) => {
    switch (block.type) {
      case "header":
        return { ...block, text: replaceProposalTokens(block.text, ctx) };
      case "text":
        return {
          ...block,
          body: block.body !== undefined ? replaceProposalTokens(block.body, ctx) : block.body,
          html: block.html !== undefined ? replaceProposalTokens(block.html, ctx) : block.html,
        };
      case "image":
        return {
          ...block,
          url: replaceProposalTokens(block.url, ctx),
          alt: block.alt !== undefined ? replaceProposalTokens(block.alt, ctx) : block.alt,
          caption: block.caption !== undefined ? replaceProposalTokens(block.caption, ctx) : block.caption,
        };
      case "video":
        return {
          ...block,
          url: replaceProposalTokens(block.url, ctx),
          title: block.title !== undefined ? replaceProposalTokens(block.title, ctx) : block.title,
        };
      case "pricing":
        return {
          ...block,
          currency: replaceProposalTokens(block.currency, ctx).toLowerCase().slice(0, 3) || block.currency,
          title: block.title !== undefined ? replaceProposalTokens(block.title, ctx) : block.title,
          lineItems: block.lineItems.map((li) => ({
            ...li,
            label: replaceProposalTokens(li.label, ctx),
          })),
        };
      case "packages":
        return {
          ...block,
          currency: replaceProposalTokens(block.currency, ctx).toLowerCase().slice(0, 3) || block.currency,
          title: block.title !== undefined ? replaceProposalTokens(block.title, ctx) : block.title,
          plan12Label:
            block.plan12Label !== undefined ? replaceProposalTokens(block.plan12Label, ctx) : block.plan12Label,
          plan24Label:
            block.plan24Label !== undefined ? replaceProposalTokens(block.plan24Label, ctx) : block.plan24Label,
          tiers: block.tiers.map((t) => ({
            ...t,
            name: replaceProposalTokens(t.name, ctx),
            features: t.features.map((f) => replaceProposalTokens(f, ctx)),
          })),
        };
      case "form":
        return {
          ...block,
          submitLabel:
            block.submitLabel !== undefined ? replaceProposalTokens(block.submitLabel, ctx) : block.submitLabel,
          fields: block.fields.map((f) => ({
            ...f,
            label: replaceProposalTokens(f.label, ctx),
            options: f.options?.map((o) => replaceProposalTokens(o, ctx)),
          })),
        };
      case "signature":
        return {
          ...block,
          title: block.title !== undefined ? replaceProposalTokens(block.title, ctx) : block.title,
          signerLabel:
            block.signerLabel !== undefined ? replaceProposalTokens(block.signerLabel, ctx) : block.signerLabel,
          termsSummary:
            block.termsSummary !== undefined ? replaceProposalTokens(block.termsSummary, ctx) : block.termsSummary,
        };
      case "embed":
        return {
          ...block,
          url: replaceProposalTokens(block.url, ctx),
          title: block.title !== undefined ? replaceProposalTokens(block.title, ctx) : block.title,
        };
      case "payment":
        return {
          ...block,
          label: block.label !== undefined ? replaceProposalTokens(block.label, ctx) : block.label,
        };
      default:
        return block;
    }
  });

  return { title, blocks };
}
