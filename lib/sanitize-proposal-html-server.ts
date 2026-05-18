import sanitizeHtml from "sanitize-html";

/**
 * Server-only HTML cleanup for agreement / audit snapshots.
 * Uses `sanitize-html` (htmlparser2) — not `jsdom` — so it works on Vercel without
 * `ERR_REQUIRE_ESM` from `html-encoding-sniffer` / `@exodus/bytes`.
 *
 * Mirrors {@link ./sanitize-proposal-html} tags, attrs, and style tightening.
 */

const ALLOWED_TAGS = [
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
] as const;

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

const SAFE_STYLE_VALUE =
  /^(?!.*\burl\s*\()(?!.*\bexpression\s*\()(?!.*javascript:)[\s\S]{0,8000}$/i;

const allowedStyles: Record<string, Record<string, RegExp[]>> = {
  "*": Object.fromEntries([...ALLOWED_CSS_PROPERTIES].map((k) => [k, [SAFE_STYLE_VALUE]])),
};

const baseAttrs = ["id", "class", "style"] as const;

const allowedAttributes: Record<string, string[]> = {
  a: [...baseAttrs, "href", "title", "target", "rel"],
  img: [...baseAttrs, "src", "alt", "width", "height", "loading", "decoding"],
  p: [...baseAttrs],
  span: [...baseAttrs],
  strong: [...baseAttrs],
  em: [...baseAttrs],
  u: [...baseAttrs],
  s: [...baseAttrs],
  ul: [...baseAttrs],
  ol: [...baseAttrs],
  li: [...baseAttrs],
  blockquote: [...baseAttrs],
  h1: [...baseAttrs],
  h2: [...baseAttrs],
  h3: [...baseAttrs],
  h4: [...baseAttrs],
  h5: [...baseAttrs],
  h6: [...baseAttrs],
  section: [...baseAttrs],
  div: [...baseAttrs, "aria-hidden"],
  hr: ["class"],
  figure: [...baseAttrs],
  figcaption: [...baseAttrs],
  code: [...baseAttrs],
  pre: [...baseAttrs],
  br: ["class"],
};

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

export function sanitizeProposalHtmlServer(html: string): string {
  const normalized = html.replace(
    /<motion-spacer\s+style="display:block;height:(\d+)px"[^>]*>\s*<\/motion-spacer>/gi,
    '<div class="proposal-agreement-spacer" style="height:$1px" aria-hidden="true"></div>',
  );
  const cleaned = sanitizeHtml(normalized, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes,
    allowedStyles,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    enforceHtmlBoundary: false,
    transformTags: {
      img: (tagName, attribs) => {
        const v = String(attribs.src ?? "").trim();
        if (v && !/^https:\/\//i.test(v)) {
          delete attribs.src;
        }
        return { tagName, attribs };
      },
    },
  });

  return cleaned.replace(/ style="([^"]*)"/g, (_match, raw: string) => {
    const safe = filterStyleAttribute(raw);
    return safe ? ` style="${safe}"` : "";
  });
}
