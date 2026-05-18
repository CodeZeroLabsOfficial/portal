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
  "text-transform",
  "line-height",
  "letter-spacing",
  "margin-top",
  "margin-bottom",
  "object-fit",
  "max-width",
  "max-height",
  "border-radius",
  "width",
  "height",
]);

function isAllowedCssValue(prop: string, val: string): boolean {
  if (/url\s*\(|expression\s*\(|javascript:/i.test(val)) return false;
  switch (prop) {
    case "line-height":
      return /^(\d+(?:\.\d+)?)(em|%)?$/i.test(val) || /^normal$/i.test(val);
    case "margin-top":
    case "margin-bottom":
      return /^(\d+(?:\.\d+)?)em$/i.test(val);
    case "letter-spacing":
      return /^-?(\d+(?:\.\d+)?)em$/i.test(val) || val === "0";
    case "text-transform":
      return /^(none|capitalize|uppercase|lowercase)$/i.test(val);
    case "height":
      return /^(\d+(?:\.\d+)?)px$/i.test(val);
    default:
      return true;
  }
}

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
      if (!isAllowedCssValue(prop, val)) return null;
      return `${prop}: ${val}`;
    })
    .filter((decl): decl is string => decl !== null)
    .join("; ");
}

export function sanitizeProposalHtml(html: string): string {
  ensureImgSrcHttpsHook();
  const normalized = html.replace(
    /<motion-spacer\s+style="display:block;height:(\d+)px"[^>]*>\s*<\/motion-spacer>/gi,
    '<div class="proposal-agreement-spacer" style="height:$1px" aria-hidden="true"></div>',
  );
  const cleaned = DOMPurify.sanitize(normalized, {
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
      "div",
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
      "aria-hidden",
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
