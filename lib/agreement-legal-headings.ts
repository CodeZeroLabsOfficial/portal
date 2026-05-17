export type AgreementLegalHeading = {
  id: string;
  label: string;
  level: number;
};

const HEADING_TAG_RE = /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;

function htmlToPlainText(fragment: string): string {
  return fragment
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyHeading(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function ensureScrollMarginClass(attrsStr: string): string {
  if (!/\bclass\s*=/.test(attrsStr)) {
    return `${attrsStr} class="scroll-mt-24"`.trim();
  }
  if (/scroll-mt-24/.test(attrsStr)) return attrsStr;
  return attrsStr.replace(/\bclass\s*=\s*["']([^"']*)["']/i, (_, cls) => `class="${cls} scroll-mt-24"`);
}

/**
 * Assigns stable `id`s to h1–h6 in agreement HTML so the modal Jump to nav can scroll to each heading.
 */
export function injectAgreementLegalHeadingIds(
  html: string,
  options?: { idPrefix?: string },
): { html: string; headings: AgreementLegalHeading[] } {
  const idPrefix = options?.idPrefix?.trim() || "agreement-section";
  const headings: AgreementLegalHeading[] = [];
  const usedIds = new Set<string>();
  let collision = 0;

  const processed = html.replace(HEADING_TAG_RE, (match, levelStr, attrs, inner) => {
    const level = Number.parseInt(levelStr, 10);
    const label = htmlToPlainText(inner);
    if (!label) return match;

    const attrsStr = typeof attrs === "string" ? attrs : "";
    const existingIdMatch = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrsStr);
    let id = existingIdMatch?.[1]?.trim();

    if (!id) {
      const slug = slugifyHeading(label);
      id = slug ? `${idPrefix}-${slug}` : `${idPrefix}-${headings.length}`;
      while (usedIds.has(id)) {
        collision += 1;
        id = `${idPrefix}-${slug || "section"}-${collision}`;
      }
    }
    usedIds.add(id);
    headings.push({ id, label, level });

    if (existingIdMatch) {
      const nextAttrs = ensureScrollMarginClass(attrsStr);
      return `<h${level}${nextAttrs ? ` ${nextAttrs.trim()}` : ""}>${inner}</h${level}>`;
    }

    return `<h${level} id="${id}" class="scroll-mt-24">${inner}</h${level}>`;
  });

  return { html: processed, headings };
}
