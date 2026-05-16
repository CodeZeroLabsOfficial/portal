/**
 * Best-effort plain text from proposal TipTap HTML (headings, paragraphs, etc.).
 * Used to keep legacy `text` / `title` / `label` fields in sync for search, tokens, and fallbacks.
 */
export function proposalRichHtmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
