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

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Rebuild `<hN>` open tag, preserving `style` / `class` etc. when injecting `id`. */
function buildHeadingOpenTag(
  level: number,
  attrsStr: string,
  id: string,
  hasExistingId: boolean,
): string {
  const attrs = attrsStr.trim();
  if (hasExistingId) {
    return attrs ? `<h${level} ${attrs}>` : `<h${level}>`;
  }
  const idAttr = `id="${escapeHtmlAttribute(id)}"`;
  if (!attrs) return `<h${level} ${idAttr}>`;
  return `<h${level} ${idAttr} ${attrs}>`;
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

    const openTag = buildHeadingOpenTag(level, attrsStr, id, Boolean(existingIdMatch));
    return `${openTag}${inner}</h${level}>`;
  });

  return { html: processed, headings };
}
