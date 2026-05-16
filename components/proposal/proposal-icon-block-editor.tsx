"use client";

import * as React from "react";
import type { IconBlock } from "@/types/proposal";
import { ProposalIconBlockDisplay } from "@/components/proposal/proposal-icon-block-display";
import { ProposalRichText } from "@/components/proposal/proposal-rich-text";
import { escapeHtml } from "@/lib/escape-html";
import { proposalRichHtmlToPlainText } from "@/lib/proposal-rich-plain-text";
import { cn } from "@/lib/utils";

function iconBlockLabelEditorHtml(block: IconBlock): string {
  if (block.labelHtml?.trim()) return block.labelHtml;
  const t = (block.label ?? "").trim();
  if (t) return `<h2>${escapeHtml(t)}</h2>`;
  return "<p></p>";
}

/**
 * Builder-only: icon + {@link ProposalRichText} caption (`variant="header"`) like section headings.
 */
export function ProposalIconBlockEditorRow({
  block,
  onChange,
  isSelected,
  onSelect,
}: {
  block: IconBlock;
  onChange: (next: IconBlock) => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "-mx-1 cursor-pointer rounded-md px-1 py-0.5 transition-shadow",
        isSelected
          ? "ring-1 ring-primary/45 ring-offset-2 ring-offset-background"
          : "hover:ring-1 hover:ring-border/60",
      )}
      onPointerDown={() => onSelect()}
    >
      <ProposalIconBlockDisplay
        block={block}
        labelSlot={
          <div
            className="min-w-0 flex-1"
            onPointerDown={(e) => e.stopPropagation()}
            onFocusCapture={() => onSelect()}
          >
            <ProposalRichText
              key={block.id}
              variant="header"
              html={iconBlockLabelEditorHtml(block)}
              placeholder="Add a description…"
              className="!border-0 !bg-transparent !px-0 !py-0 !shadow-none"
              onChange={(html) =>
                onChange({
                  ...block,
                  labelHtml: html,
                  label: proposalRichHtmlToPlainText(html) || undefined,
                })
              }
            />
          </div>
        }
      />
    </div>
  );
}
