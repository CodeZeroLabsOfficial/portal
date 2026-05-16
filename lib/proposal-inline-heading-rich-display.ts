import { cn } from "@/lib/utils";
import { WORKSPACE_DETAIL_PAGE_TITLE_CLASS } from "@/lib/workspace-page-typography";

/**
 * Sanitized rich HTML for **section header** blocks on the public page — workspace-scale title
 * typography. For icon captions and accordion panel titles use {@link PROPOSAL_CAPTION_RICH_DISPLAY_CLASS}.
 */
export const PROPOSAL_INLINE_HEADING_RICH_DISPLAY_CLASS = cn(
  "proposal-rich-text max-w-none min-w-0 scroll-mt-20 text-foreground",
  WORKSPACE_DETAIL_PAGE_TITLE_CLASS,
  "[&_a]:text-primary [&_a]:underline",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_h1]:m-0 [&_h2]:m-0 [&_h3]:m-0 [&_h4]:m-0 [&_p]:m-0",
  "[&_h1]:text-[1em] [&_h2]:text-[1em] [&_h3]:text-[1em] [&_h4]:text-[1em] [&_p]:text-[1em]",
  "[&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
);
