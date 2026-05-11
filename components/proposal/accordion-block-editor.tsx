"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { AccordionBlock, AccordionPanel } from "@/types/proposal";
import { ProposalRichText } from "@/components/proposal/proposal-rich-text";
import { ProposalSectionEditorChromeContext } from "@/components/proposal/proposal-section-editor-chrome";
import { escapeHtml } from "@/lib/escape-html";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProposalAccordionExpandSurface } from "@/components/proposal/proposal-accordion-expand-surface";

function newPanelId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function panelEditorHtml(p: AccordionPanel): string {
  if (p.html?.trim()) return p.html;
  if (p.body?.trim()) return `<p>${escapeHtml(p.body)}</p>`;
  return "<p></p>";
}

const LIGHT_SECTION_CHROME = { seamless: false, prefersLight: false } as const;

export function AccordionBlockEditor({
  block,
  onChange,
}: {
  block: AccordionBlock;
  onChange: (next: AccordionBlock) => void;
}) {
  const panels = block.panels ?? [];
  const firstId = panels[0]?.id ?? "";
  const panelIdsKey = panels.map((p) => p.id).join(",");

  const [openIds, setOpenIds] = React.useState<Record<string, boolean>>(() =>
    firstId ? { [firstId]: true } : {},
  );

  React.useEffect(() => {
    const list = block.panels ?? [];
    const ids = new Set(list.map((p) => p.id));
    setOpenIds((prev) => {
      const next: Record<string, boolean> = {};
      for (const id of ids) {
        if (id in prev) next[id] = prev[id];
      }
      if (ids.size && !Object.keys(next).some((k) => next[k])) {
        const first = list[0]?.id;
        if (first) next[first] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when panel membership changes
  }, [panelIdsKey]);

  function patchPanels(nextPanels: AccordionPanel[]) {
    onChange({ ...block, panels: nextPanels });
  }

  function updatePanel(idx: number, patch: Partial<AccordionPanel>) {
    patchPanels(panels.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  function togglePanel(id: string) {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border/70">
        {panels.map((p, idx) => {
          const open = Boolean(openIds[p.id]);
          const contentId = `accordion-panel-${p.id}`;
          return (
            <div key={p.id} className="group/panel border-b border-border/60 last:border-b-0">
              <div className="flex items-center gap-2 px-4 py-4 sm:px-5">
                <input
                  value={p.title}
                  onChange={(e) => updatePanel(idx, { title: e.target.value })}
                  placeholder="Untitled panel"
                  aria-label="Panel heading"
                  className={cn(
                    "min-w-0 flex-1 border-0 bg-transparent py-1 text-lg font-semibold tracking-tight text-foreground",
                    "placeholder:text-muted-foreground/80",
                    "shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={panels.length <= 1}
                    className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/panel:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                    aria-label="Remove panel"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = panels.filter((x) => x.id !== p.id);
                      patchPanels(next);
                      setOpenIds((prev) => {
                        const rest = { ...prev };
                        delete rest[p.id];
                        return rest;
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#673AB7] transition-colors hover:bg-white/10 hover:text-[#5E35B1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#673AB7]/40"
                    aria-expanded={open}
                    aria-controls={contentId}
                    aria-label={open ? "Collapse panel" : "Expand panel"}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePanel(p.id);
                    }}
                  >
                    {open ? (
                      <ChevronDown className="h-5 w-5" aria-hidden />
                    ) : (
                      <ChevronRight className="h-5 w-5" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
              <ProposalAccordionExpandSurface
                open={open}
                motionKey={contentId}
                id={contentId}
                data-proposal-accordion-light-surface
                className={cn(
                  "w-full border-t border-border/45 bg-white px-4 py-4 text-zinc-900 sm:px-5",
                  idx === panels.length - 1 && "rounded-b-2xl",
                )}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ProposalSectionEditorChromeContext.Provider value={LIGHT_SECTION_CHROME}>
                  <ProposalRichText
                    key={p.id}
                    html={panelEditorHtml(p)}
                    className="!px-0 [&_.ProseMirror]:min-h-[100px]"
                    onChange={(html) => updatePanel(idx, { html, body: undefined })}
                  />
                </ProposalSectionEditorChromeContext.Provider>
              </ProposalAccordionExpandSurface>
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          const id = newPanelId();
          patchPanels([...panels, { id, title: "New panel", html: "<p></p>" }]);
          setOpenIds((prev) => ({ ...prev, [id]: true }));
        }}
      >
        <Plus className="h-4 w-4" />
        Add panel
      </Button>
    </div>
  );
}
