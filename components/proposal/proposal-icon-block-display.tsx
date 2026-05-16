import type { ReactNode } from "react";
import type { IconBlock } from "@/types/proposal";
import { cn } from "@/lib/utils";
import { resolveProposalPresetIcon } from "@/lib/proposal-icon-presets";
import {
  PROPOSAL_CAPTION_PLAIN_CLASS,
  PROPOSAL_CAPTION_RICH_DISPLAY_CLASS,
} from "@/lib/proposal-inline-caption-rich-display";
import { sanitizeProposalHtml } from "@/lib/sanitize-proposal-html";

export type ProposalIconBlockDisplayProps = {
  block: IconBlock;
  className?: string;
  /**
   * When set, replaces the read-only caption (e.g. rich editor in the builder).
   * The slot is laid out in the same flex column as the public caption with `min-w-0 flex-1`.
   */
  labelSlot?: ReactNode;
};

/** Public + builder: icon/emoji and caption with hanging-indent multi-line caption layout. */
export function ProposalIconBlockDisplay({ block, className, labelSlot }: ProposalIconBlockDisplayProps) {
  const IconGlyph = resolveProposalPresetIcon(block.iconName);
  const emoji = block.emoji?.trim();
  const hasGlyph = Boolean(IconGlyph || emoji);
  const label = (block.label ?? "").trim();
  const rich = (block.labelHtml ?? "").trim();

  if (!labelSlot) {
    if (!hasGlyph && !label && !rich) return null;
  }

  const captionEl = labelSlot ? (
    <div className="min-w-0 flex-1">{labelSlot}</div>
  ) : rich ? (
    <div
      className={cn(PROPOSAL_CAPTION_RICH_DISPLAY_CLASS, hasGlyph && "flex-1")}
      dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(block.labelHtml!) }}
    />
  ) : label ? (
    <span className={cn(PROPOSAL_CAPTION_PLAIN_CLASS, "min-w-0", hasGlyph && "flex-1")}>
      {label}
    </span>
  ) : null;

  if (!captionEl && !hasGlyph) return null;

  return (
    <div className={cn("flex items-start gap-3 py-2", className)}>
      {hasGlyph ? (
        <div className="flex shrink-0 justify-center leading-none" aria-hidden>
          {IconGlyph ? (
            <IconGlyph className="h-10 w-10 text-foreground" />
          ) : (
            <span className="block translate-y-px text-4xl leading-none">{emoji}</span>
          )}
        </div>
      ) : null}
      {captionEl}
    </div>
  );
}
