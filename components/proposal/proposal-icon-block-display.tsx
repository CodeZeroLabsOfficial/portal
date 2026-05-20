import type { MouseEvent, PointerEvent, ReactNode } from "react";
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
  /** Floated above the icon glyph in the builder (e.g. icon picker bubble). */
  iconToolbarSlot?: ReactNode;
  /** Builder: highlight ring on the glyph when it is the active target. */
  glyphChromeActive?: boolean;
  /** Builder: pointer down on the glyph (e.g. show icon picker bubble). */
  onGlyphPointerDown?: (e: PointerEvent) => void;
  onGlyphClick?: (e: MouseEvent) => void;
};

/** Public + builder: icon/emoji and caption with hanging-indent multi-line caption layout. */
export function ProposalIconBlockDisplay({
  block,
  className,
  labelSlot,
  iconToolbarSlot,
  glyphChromeActive = false,
  onGlyphPointerDown,
  onGlyphClick,
}: ProposalIconBlockDisplayProps) {
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
        <div
          className={cn(
            "relative shrink-0 rounded-md",
            glyphChromeActive &&
              "ring-1 ring-primary/45 ring-offset-2 ring-offset-background",
            onGlyphPointerDown && "cursor-pointer",
          )}
          onPointerDown={onGlyphPointerDown}
          onClick={onGlyphClick}
        >
          {iconToolbarSlot ? (
            <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap">
              <div className="pointer-events-auto">{iconToolbarSlot}</div>
            </div>
          ) : null}
          <div className="flex shrink-0 justify-center leading-none" aria-hidden>
            {IconGlyph ? (
              <IconGlyph className="h-10 w-10 text-foreground" />
            ) : (
              <span className="block translate-y-px text-4xl leading-none">{emoji}</span>
            )}
          </div>
        </div>
      ) : null}
      {captionEl}
    </div>
  );
}
