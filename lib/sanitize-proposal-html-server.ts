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
  "hr",
  "figure",
  "figcaption",
  "code",
  "pre",
  "img",
] as const;

const ALLOWED_CSS_PROPERTIES = new Set([
  "color",
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
      if (/url\s*\(|expression\s*\(|javascript:/i.test(val)) return null;
      return `${prop}: ${val}`;
    })
    .filter((decl): decl is string => decl !== null)
    .join("; ");
}

export function sanitizeProposalHtmlServer(html: string): string {
  const cleaned = sanitizeHtml(html, {
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
