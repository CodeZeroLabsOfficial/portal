"use client";

import * as React from "react";
import { ChevronDown, Search, Trash2 } from "lucide-react";
import type { IconBlock } from "@/types/proposal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PROPOSAL_EDITOR_BUBBLE_TOOLBAR_SHELL_CLASSES } from "@/lib/proposal-editor-glass";
import { cn } from "@/lib/utils";
import {
  PROPOSAL_ICON_DEFAULT_NAME,
  PROPOSAL_ICON_SUGGESTED_NAMES,
  PROPOSAL_ICONS,
  filterProposalIconsByQuery,
  proposalPresetIconLabel,
  resolveProposalPresetIcon,
} from "@/lib/proposal-icon-presets";

/** Matches {@link BlockToolbar} `appearance="surface"` and {@link ProposalImageBlockToolbar} pill chrome. */
const barShell = cn(
  "inline-flex max-w-[calc(100vw-3rem)] shrink-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-full border p-1",
  PROPOSAL_EDITOR_BUBBLE_TOOLBAR_SHELL_CLASSES,
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
);

const triggerBtn = cn(
  "inline-flex h-8 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "text-muted-foreground hover:bg-background hover:text-foreground data-[state=open]:bg-background data-[state=open]:text-foreground",
);

export type ProposalIconColumnToolbarActions = {
  onRemove: () => void;
};

export type ProposalIconBlockToolbarProps = {
  block: IconBlock;
  onChange: (next: IconBlock) => void;
  /** `toolbar` = single control for {@link BlockToolbar} `backdropPickerSlot`; `embedded` = full mini-bar for column cells. */
  variant: "toolbar" | "embedded";
  className?: string;
  /** Column cell: show remove control in the embedded bar. */
  onRemove?: () => void;
};

export function ProposalIconBlockToolbar({
  block,
  onChange,
  variant,
  className,
  onRemove,
}: ProposalIconBlockToolbarProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const resolved = resolveProposalPresetIcon(block.iconName);
  const legacyEmoji = (block.emoji ?? "").trim();
  const fallbackIcon = resolveProposalPresetIcon(PROPOSAL_ICON_DEFAULT_NAME);
  const triggerIcon = resolved ?? fallbackIcon;
  const triggerLabel = block.iconName?.trim()
    ? proposalPresetIconLabel(block.iconName)
    : legacyEmoji
      ? "Emoji"
      : proposalPresetIconLabel(PROPOSAL_ICON_DEFAULT_NAME);

  function pick(name: string) {
    onChange({
      ...block,
      iconName: name,
      emoji: undefined,
    });
    setOpen(false);
  }

  const filtered = filterProposalIconsByQuery(query);
  const suggestedSet = new Set(PROPOSAL_ICON_SUGGESTED_NAMES);
  const suggested = PROPOSAL_ICON_SUGGESTED_NAMES.map((n) => PROPOSAL_ICONS.find((e) => e.name === n)).filter(
    Boolean,
  ) as (typeof PROPOSAL_ICONS)[number][];
  const suggestedFiltered = suggested.filter(
    (e) =>
      !query.trim() ||
      e.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      e.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const rest = filtered.filter((e) => !suggestedSet.has(e.name));

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(triggerBtn, variant === "embedded" && "max-w-[min(11rem,calc(100%-2.5rem))]")}
          aria-label="Choose icon"
          title="Choose icon"
        >
          {resolved ? (
            React.createElement(resolved, { className: "h-4 w-4 shrink-0", "aria-hidden": true })
          ) : legacyEmoji ? (
            <span className="text-base leading-none" aria-hidden>
              {legacyEmoji}
            </span>
          ) : triggerIcon ? (
            React.createElement(triggerIcon, { className: "h-4 w-4 shrink-0", "aria-hidden": true })
          ) : null}
          <span className="min-w-0 truncate">{triggerLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-2rem))] border-border bg-popover p-0 text-popover-foreground shadow-md dark:border-zinc-700/60 dark:bg-zinc-900/98 dark:text-zinc-100"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-border/70 p-2 dark:border-zinc-700/60">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground dark:text-zinc-500"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons"
              className="h-9 border-border/80 bg-muted/40 pl-8 text-sm dark:border-zinc-700/60 dark:bg-zinc-800/80"
            />
          </div>
        </div>
        <div className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain p-1.5">
          {suggestedFiltered.length > 0 ? (
            <div className="mb-2">
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
                Suggested
              </p>
              <ul className="space-y-0.5">
                {suggestedFiltered.map((opt) => (
                  <li key={opt.name}>
                    <button
                      type="button"
                      onClick={() => pick(opt.name)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        "hover:bg-muted/80 dark:hover:bg-zinc-800/90",
                        block.iconName === opt.name && "bg-muted dark:bg-zinc-800",
                      )}
                    >
                      <opt.Icon className="h-4 w-4 shrink-0 text-muted-foreground dark:text-zinc-400" aria-hidden />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {rest.length > 0 ? (
            <div>
              {suggestedFiltered.length > 0 ? (
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
                  All icons
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {rest.map((opt) => (
                  <li key={opt.name}>
                    <button
                      type="button"
                      onClick={() => pick(opt.name)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        "hover:bg-muted/80 dark:hover:bg-zinc-800/90",
                        block.iconName === opt.name && "bg-muted dark:bg-zinc-800",
                      )}
                    >
                      <opt.Icon className="h-4 w-4 shrink-0 text-muted-foreground dark:text-zinc-400" aria-hidden />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground dark:text-zinc-500">No icons match.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (variant === "embedded") {
    return (
      <div className={cn(barShell, className)}>
        {picker}
        {onRemove ? (
          <>
            <span className="mx-0.5 h-5 w-px shrink-0 bg-border dark:bg-zinc-600" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-background hover:text-destructive dark:hover:text-red-300"
              aria-label="Remove block"
              title="Remove block"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  return <div className={cn("inline-flex", className)}>{picker}</div>;
}
