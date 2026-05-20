import { formatAddressLines } from "@/lib/format";
import { formatProposalMergeDate } from "@/lib/proposal-locality-dates";
import { PROPOSAL_MERGE_TOKEN_CHOICES } from "@/lib/proposal-merge-token-choices";

export { PROPOSAL_MERGE_TOKEN_CHOICES };
export type { ProposalMergeTokenChoice } from "@/lib/proposal-merge-token-choices";
import type { CustomerRecord } from "@/types/customer";
import type { OpportunityRecord } from "@/types/opportunity";
import type {
  ColumnsBlock,
  ProposalAgreementChildBlock,
  ProposalBlock,
  ProposalColumnChildBlock,
  ProposalContentBlock,
  ProposalDocument,
} from "@/types/proposal";

export interface ProposalTokenContext {
  customer: CustomerRecord;
  opportunity?: OpportunityRecord | null;
  /** IANA zone from Settings → Locality (`PortalUser.timeZone`) — drives `{{date}}` calendar day. */
  timeZone?: string;
  /**
   * Used for `{{date}}` (long localised date). When omitted, `replaceProposalTokens` uses the time of each call;
   * `applyProposalTokensToDocument` sets this once so every field in a document shares the same value.
   */
  mergedAt?: Date;
}

function firstNameFromFullName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return "";
  const [first] = t.split(/\s+/);
  return first ?? "";
}

function customerAddress(customer: CustomerRecord): string {
  return formatAddressLines({
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    region: customer.region,
    postalCode: customer.postalCode,
    country: customer.country,
  }).join(", ");
}

/** Replace merge tokens in strings (case-insensitive): `{{client}}`, `{{first_name}}`, `{{email}}`, `{{company}}`, `{{acn}}`, `{{address}}`, `{{opportunity}}`, `{{deal_amount}}`, `{{date}}`. */
export function replaceProposalTokens(text: string, ctx: ProposalTokenContext): string {
  const { customer, opportunity } = ctx;
  const at = ctx.mergedAt ?? new Date();
  /** Long calendar date at merge time (en-AU wording; optional IANA zone from staff locality). */
  const date = formatProposalMergeDate(at, ctx.timeZone);
  const company = customer.company?.trim() ?? "";
  const oppName = opportunity?.name?.trim() ?? "";
  let dealAmount = "";
  if (opportunity && typeof opportunity.amountMinor === "number") {
    dealAmount = (opportunity.amountMinor / 100).toLocaleString(undefined, {
      style: "currency",
      currency: opportunity.currency.toUpperCase(),
    });
  }

  const name = customer.name?.trim() ?? "";
  const firstName = firstNameFromFullName(name);
  const vars: Record<string, string> = {
    client: name,
    first_name: firstName,
    email: customer.email?.trim() ?? "",
    company,
    acn: customer.companyAcn?.trim() ?? "",
    address: customerAddress(customer),
    opportunity: oppName,
    deal_amount: dealAmount,
    date,
  };

  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), value);
  }
  return out;
}

function mapContentBlock(block: ProposalContentBlock, ctx: ProposalTokenContext): ProposalContentBlock {
  switch (block.type) {
    case "splash":
      return {
        ...block,
        html: block.html !== undefined ? replaceProposalTokens(block.html, ctx) : block.html,
        body: block.body !== undefined ? replaceProposalTokens(block.body, ctx) : block.body,
        background: {
          ...block.background,
          url:
            block.background.url !== undefined
              ? replaceProposalTokens(block.background.url, ctx)
              : block.background.url,
          videoUrl:
            block.background.videoUrl !== undefined
              ? replaceProposalTokens(block.background.videoUrl, ctx)
              : block.background.videoUrl,
          posterUrl:
            block.background.posterUrl !== undefined
              ? replaceProposalTokens(block.background.posterUrl, ctx)
              : block.background.posterUrl,
        },
      };
    case "header":
      return {
        ...block,
        text: replaceProposalTokens(block.text, ctx),
        html: block.html !== undefined ? replaceProposalTokens(block.html, ctx) : block.html,
      };
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
        titleHtml:
          block.titleHtml !== undefined ? replaceProposalTokens(block.titleHtml, ctx) : block.titleHtml,
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
    case "agreement":
      return {
        ...block,
        children: block.children.map((c) => mapContentBlock(c as ProposalContentBlock, ctx) as ProposalAgreementChildBlock),
        contractTemplateId: block.contractTemplateId,
        contractTemplateLabel: block.contractTemplateLabel,
        buttonLabel:
          block.buttonLabel !== undefined ? replaceProposalTokens(block.buttonLabel, ctx) : block.buttonLabel,
        agreementTitle:
          block.agreementTitle !== undefined
            ? replaceProposalTokens(block.agreementTitle, ctx)
            : block.agreementTitle,
        introHtml:
          block.introHtml !== undefined ? replaceProposalTokens(block.introHtml, ctx) : block.introHtml,
        legalHtml:
          block.legalHtml !== undefined ? replaceProposalTokens(block.legalHtml, ctx) : block.legalHtml,
        prefillSignerName:
          block.prefillSignerName !== undefined
            ? replaceProposalTokens(block.prefillSignerName, ctx)
            : block.prefillSignerName,
        prefillSignerEmail:
          block.prefillSignerEmail !== undefined
            ? replaceProposalTokens(block.prefillSignerEmail, ctx)
            : block.prefillSignerEmail,
        prefillSignerOrganization:
          block.prefillSignerOrganization !== undefined
            ? replaceProposalTokens(block.prefillSignerOrganization, ctx)
            : block.prefillSignerOrganization,
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
    case "divider":
      return block;
    case "spacer":
      return block;
    case "accordion":
      return {
        ...block,
        panels: block.panels.map((p) => ({
          ...p,
          title: replaceProposalTokens(p.title, ctx),
          titleHtml: p.titleHtml !== undefined ? replaceProposalTokens(p.titleHtml, ctx) : p.titleHtml,
          html: p.html !== undefined ? replaceProposalTokens(p.html, ctx) : p.html,
          body: p.body !== undefined ? replaceProposalTokens(p.body, ctx) : p.body,
        })),
      };
    case "columns": {
      const col = block as ColumnsBlock;
      return {
        ...col,
        stacks: col.stacks.map((stack) =>
          stack.map((c) => mapContentBlock(c as ProposalContentBlock, ctx) as ProposalColumnChildBlock),
        ),
        ...(col.columnFlex ? { columnFlex: [...col.columnFlex] } : {}),
      };
    }
    case "icon":
      return {
        ...block,
        iconName: block.iconName !== undefined ? replaceProposalTokens(block.iconName, ctx) : block.iconName,
        emoji: block.emoji !== undefined ? replaceProposalTokens(block.emoji, ctx) : block.emoji,
        label: block.label !== undefined ? replaceProposalTokens(block.label, ctx) : block.label,
        labelHtml: block.labelHtml !== undefined ? replaceProposalTokens(block.labelHtml, ctx) : block.labelHtml,
      };
    default:
      return block;
  }
}

function mapTopLevelBlock(block: ProposalBlock, ctx: ProposalTokenContext): ProposalBlock {
  if (block.type === "section") {
    return {
      ...block,
      children: block.children.map((c) => mapContentBlock(c, ctx)),
    };
  }
  return mapContentBlock(block as ProposalContentBlock, ctx);
}

export function applyProposalTokensToDocument(doc: ProposalDocument, ctx: ProposalTokenContext): ProposalDocument {
  const effectiveCtx: ProposalTokenContext = { ...ctx, mergedAt: ctx.mergedAt ?? new Date() };
  const title = replaceProposalTokens(doc.title, effectiveCtx);
  const blocks = doc.blocks.map((block) => mapTopLevelBlock(block, effectiveCtx));
  return { title, blocks };
}
