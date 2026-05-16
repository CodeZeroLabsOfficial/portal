import { cn } from "@/lib/utils";

/**
 * Sanitized rich HTML for **icon captions** and **accordion panel titles** on the public page.
 *
 * Mirrors the heading scale in {@link components/proposal/proposal-rich-text} `TIPTAP_PROSE_TYPOGRAPHY`
 * so H1–H4 render like the proposal builder. Do not use {@link PROPOSAL_INLINE_HEADING_RICH_DISPLAY_CLASS}
 * here — that applies workspace hero title sizing (`text-2xl`/`3xl`) and makes captions and nested
 * headings incorrectly large.
 */
export const PROPOSAL_CAPTION_RICH_DISPLAY_CLASS = cn(
  "proposal-rich-text max-w-none min-w-0 text-foreground",
  "[&_p]:mb-1.5 [&_p:last-child]:mb-0",
  "[&_h1]:mt-2 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight",
  "[&_h2]:mt-1.5 [&_h2]:mb-1.5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-tight",
  "[&_h3]:mt-1.5 [&_h3]:mb-1.5 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug",
  "[&_h4]:mt-1 [&_h4]:mb-1 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:leading-snug",
  "[&_a]:text-primary [&_a]:underline",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
);

/** Plain caption next to an icon when there is no `labelHtml` — visually aligned with body + h4 scale. */
export const PROPOSAL_CAPTION_PLAIN_CLASS = cn(
  "text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg",
);
