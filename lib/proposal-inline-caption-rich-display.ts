import { cn } from "@/lib/utils";
import { PROPOSAL_RICH_HEADING_LEVEL_CLASSES } from "@/lib/proposal-rich-heading-typography";

/**
 * Sanitized rich HTML for **icon captions** and **accordion panel titles** on the public page.
 *
 * Uses the same H1–H4 scale as Heading blocks and the proposal builder.
 */
export const PROPOSAL_CAPTION_RICH_DISPLAY_CLASS = cn(
  "proposal-rich-text max-w-none min-w-0 text-foreground",
  "[&_p]:mb-1.5 [&_p:last-child]:mb-0",
  PROPOSAL_RICH_HEADING_LEVEL_CLASSES,
  "[&_a]:text-primary [&_a]:underline",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
);

/** Plain caption next to an icon when there is no `labelHtml` — visually aligned with body + h4 scale. */
export const PROPOSAL_CAPTION_PLAIN_CLASS = cn(
  "text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg",
);
