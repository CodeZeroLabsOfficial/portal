import { escapeHtml } from "@/lib/escape-html";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import type { ContractTemplateRecord } from "@/types/contract-template";
import type {
  AccordionBlock,
  ColumnsBlock,
  HeaderBlock,
  ProposalBlock,
  ProposalContentBlock,
  ProposalDocument,
  SectionBlock,
  TextBlock,
} from "@/types/proposal";

function newId(): string {
  return `ct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Matches {@link components/proposal/proposal-document-view} spacer clamp (1–2400px). */
export function clampProposalSpacerHeightPx(heightPx: number | undefined): number {
  return Math.min(2400, Math.max(1, Math.round(heightPx ?? 40)));
}

/** Serialized into agreement intro/legal HTML; must survive {@link ./sanitize-proposal-html}. */
export function proposalSpacerBlockToHtml(heightPx: number | undefined): string {
  const px = clampProposalSpacerHeightPx(heightPx);
  return `<div class="proposal-agreement-spacer" style="height:${px}px" aria-hidden="true"></div>`;
}

function contentBlockToHtml(block: ProposalContentBlock): string {
  switch (block.type) {
    case "header": {
      const hb = block as HeaderBlock;
      if (hb.html?.trim()) return hb.html.trim();
      const text = (hb.text ?? "").trim();
      return text ? `<h2>${escapeHtml(text)}</h2>` : "";
    }
    case "text": {
      const tb = block as TextBlock;
      if (tb.html?.trim()) return tb.html.trim();
      const body = (tb.body ?? "").trim();
      return body ? `<p>${escapeHtml(body)}</p>` : "";
    }
    case "image": {
      const url = block.url?.trim();
      if (!url) return "";
      const alt = block.alt?.trim() ? escapeHtml(block.alt.trim()) : "";
      const cap = block.caption?.trim();
      const img = `<img src="${escapeHtml(url)}" alt="${alt}" />`;
      return cap ? `<figure>${img}<figcaption>${escapeHtml(cap)}</figcaption></figure>` : img;
    }
    case "divider":
      return "<hr />";
    case "spacer":
      return proposalSpacerBlockToHtml(block.heightPx);
    case "accordion": {
      const ab = block as AccordionBlock;
      const panels = (ab.panels ?? [])
        .map((p) => {
          const title = escapeHtml((p.title ?? "").trim() || "Section");
          const body = p.html?.trim() || (p.body?.trim() ? `<p>${escapeHtml(p.body.trim())}</p>` : "");
          return body ? `<h3>${title}</h3>${body}` : "";
        })
        .filter(Boolean);
      return panels.join("\n");
    }
    case "columns": {
      const cb = block as ColumnsBlock;
      return cb.stacks
        .map((stack) =>
          stack
            .map((child) => contentBlockToHtml(child as ProposalContentBlock))
            .filter(Boolean)
            .join(""),
        )
        .filter(Boolean)
        .join("\n");
    }
    default:
      return "";
  }
}

function blockToHtml(block: ProposalBlock): string {
  if (block.type === "section") {
    const sb = block as SectionBlock;
    const inner = (sb.children ?? [])
      .map((c) => contentBlockToHtml(c))
      .filter(Boolean)
      .join("\n");
    return inner ? `<section>${inner}</section>` : "";
  }
  return contentBlockToHtml(block as ProposalContentBlock);
}

/** Split root blocks into intro (before first section) and legal body (sections + trailing content). */
export function contractTemplateDocumentToHtml(doc: ProposalDocument): {
  introHtml?: string;
  legalHtml: string;
} {
  const introParts: string[] = [];
  const legalParts: string[] = [];
  let seenSection = false;

  for (const block of doc.blocks) {
    if (block.type === "section") seenSection = true;
    const html = blockToHtml(block);
    if (!html) continue;
    if (!seenSection && block.type !== "section") {
      introParts.push(html);
    } else {
      legalParts.push(html);
    }
  }

  const introHtml = introParts.join("\n").trim();
  const legalHtml = legalParts.join("\n").trim();
  return {
    introHtml: introHtml || undefined,
    legalHtml,
  };
}

/** Build editor document from Firestore record (blocks field or legacy HTML fields). */
export function contractTemplateRecordToDocument(record: ContractTemplateRecord): ProposalDocument {
  if (record.document?.blocks && record.document.blocks.length > 0) {
    return parseProposalDocument(record.document);
  }

  const blocks: ProposalBlock[] = [];
  if (record.introHtml?.trim()) {
    blocks.push({ id: newId(), type: "text", html: record.introHtml.trim() });
  }
  if (record.legalHtml?.trim()) {
    blocks.push({ id: newId(), type: "text", html: record.legalHtml.trim() });
  }

  return parseProposalDocument({
    title: record.agreementTitle?.trim() || "Services Agreement",
    blocks,
  });
}
