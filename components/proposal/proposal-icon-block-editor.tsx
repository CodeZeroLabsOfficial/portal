"use client";

import * as React from "react";
import type { IconBlock } from "@/types/proposal";
import { ProposalIconBlockDisplay } from "@/components/proposal/proposal-icon-block-display";
import { ProposalRichText } from "@/components/proposal/proposal-rich-text";
import { escapeHtml } from "@/lib/escape-html";
import { proposalRichHtmlToPlainText } from "@/lib/proposal-rich-plain-text";

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
  toolbar,
}: {
  block: IconBlock;
  onChange: (next: IconBlock) => void;
  isSelected: boolean;
  onSelect: () => void;
  /** Icon picker bubble — anchored above the glyph by {@link ProposalIconBlockDisplay}. */
  toolbar?: React.ReactNode;
}) {
  const [glyphActive, setGlyphActive] = React.useState(false);

  React.useEffect(() => {
    if (!isSelected) setGlyphActive(false);
  }, [isSelected]);

  return (
    <div className="-mx-1 rounded-md px-1 py-0.5">
      <ProposalIconBlockDisplay
        block={block}
        glyphChromeActive={glyphActive}
        onGlyphPointerDown={(e) => {
          e.stopPropagation();
          setGlyphActive(true);
          onSelect();
        }}
        iconToolbarSlot={glyphActive ? toolbar : undefined}
        labelSlot={
          <div
            className="min-w-0 flex-1"
            onPointerDown={(e) => {
              e.stopPropagation();
              setGlyphActive(false);
              onSelect();
            }}
          >
            <ProposalRichText
              key={block.id}
              variant="header"
              html={iconBlockLabelEditorHtml(block)}
              placeholder="Add a description…"
              className="!border-0 !bg-transparent !px-0 !py-0 !shadow-none"
              bubbleMenuRequiresTextSelection
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
