import { cn } from "@/lib/utils";
import { PROPOSAL_RICH_HEADING_LEVEL_CLASSES } from "@/lib/proposal-rich-heading-typography";

/**
 * Sanitized rich HTML for **Heading** blocks on the public page — same H1–H4 scale as the
 * proposal builder. For icon captions and accordion panel titles use
 * {@link PROPOSAL_CAPTION_RICH_DISPLAY_CLASS}.
 */
export const PROPOSAL_INLINE_HEADING_RICH_DISPLAY_CLASS = cn(
  "proposal-rich-text max-w-none min-w-0 scroll-mt-20 text-foreground",
  PROPOSAL_RICH_HEADING_LEVEL_CLASSES,
  "[&_p]:mb-1.5 [&_p:last-child]:mb-0",
  "[&_a]:text-primary [&_a]:underline",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
);
