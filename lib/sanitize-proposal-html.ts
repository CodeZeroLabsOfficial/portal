import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize rich text from proposal text blocks before rendering in the browser or PDF shell.
 */
export function sanitizeProposalHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
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
      "code",
      "pre",
    ],
    ALLOWED_ATTR: ["href", "title", "target", "rel", "class"],
    ALLOW_DATA_ATTR: false,
  });
}
