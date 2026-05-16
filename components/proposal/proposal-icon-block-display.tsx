import type { IconBlock } from "@/types/proposal";
import { cn } from "@/lib/utils";
import { resolveProposalPresetIcon } from "@/lib/proposal-icon-presets";

export type ProposalIconBlockDisplayProps = {
  block: IconBlock;
  className?: string;
};

/** Public + builder: icon/emoji and caption with hanging-indent multi-line caption layout. */
export function ProposalIconBlockDisplay({ block, className }: ProposalIconBlockDisplayProps) {
  const IconGlyph = resolveProposalPresetIcon(block.iconName);
  const emoji = block.emoji?.trim();
  const hasGlyph = Boolean(IconGlyph || emoji);
  const label = block.label?.trim();

  if (!hasGlyph && !label) return null;

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
      {label ? (
        <span
          className={cn(
            "min-w-0 text-xl font-semibold leading-snug tracking-tight text-foreground",
            hasGlyph && "flex-1",
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
