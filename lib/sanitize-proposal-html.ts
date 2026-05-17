import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize rich text from proposal text blocks before rendering in the browser or PDF shell.
 *
 * Inline `style` is allowed so TipTap inline marks (font size, color, alignment) survive
 * the round-trip — but only the small CSS allowlist below is preserved. DOMPurify also
 * strips dangerous values (`url()`, `expression()`, etc.) at parse time.
 */
let proposalSanitizeImgHookInstalled = false;

function ensureImgSrcHttpsHook() {
  if (proposalSanitizeImgHookInstalled) return;
  proposalSanitizeImgHookInstalled = true;
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (node.nodeName === "IMG" && data.attrName === "src") {
      const v = String(data.attrValue ?? "").trim();
      if (!/^https:\/\//i.test(v)) {
        data.keepAttr = false;
      }
    }
  });
}

const ALLOWED_CSS_PROPERTIES = new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-align",
  "text-decoration",
  "line-height",
  "letter-spacing",
  "object-fit",
  "max-width",
  "max-height",
  "border-radius",
  "width",
  "height",
]);

function filterStyleAttribute(value: string): string {
  return value
    .split(";")
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(":");
      if (idx <= 0) return null;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const val = decl.slice(idx + 1).trim();
      if (!ALLOWED_CSS_PROPERTIES.has(prop)) return null;
      if (/url\s*\(|expression\s*\(|javascript:/i.test(val)) return null;
      return `${prop}: ${val}`;
    })
    .filter((decl): decl is string => decl !== null)
    .join("; ");
}

export function sanitizeProposalHtml(html: string): string {
  ensureImgSrcHttpsHook();
  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "span",
      "strong",
      "em",
      "u",
      "s",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "section",
      "hr",
      "figure",
      "figcaption",
      "code",
      "pre",
      "img",
    ],
    ALLOWED_ATTR: [
      "id",
      "href",
      "title",
      "target",
      "rel",
      "class",
      "style",
      "src",
      "alt",
      "width",
      "height",
      "loading",
      "decoding",
    ],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM: false,
  });

  // Tighten the `style` attribute to our allowlist by post-processing the cleaned HTML.
  // DOMPurify already neutralised script-y values; this pass enforces the property allowlist
  // so future TipTap marks can't sneak through unsupported CSS.
  return cleaned.replace(/ style="([^"]*)"/g, (_match, raw: string) => {
    const safe = filterStyleAttribute(raw);
    return safe ? ` style="${safe}"` : "";
  });
}
