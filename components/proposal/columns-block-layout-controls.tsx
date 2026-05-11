"use client";

import {
  AlignHorizontalDistributeCenter,
  AlignVerticalJustifyCenter,
  Check,
  LayoutGrid,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ColumnLayoutCount,
  coerceColumnFlex,
  normalizeColumnFlexForStorage,
  resizeColumnFlexWithStacks,
  resizeColumnStacks,
} from "@/lib/proposal-columns";
import type {
  ColumnsBlock,
  ColumnsBlockGapPreset,
  ColumnsBlockRowAlign,
} from "@/types/proposal";

const GAP_OPTIONS: { value: ColumnsBlockGapPreset; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Relaxed" },
];

const INSET_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "None" },
  { value: 8, label: "8 px" },
  { value: 16, label: "16 px" },
  { value: 24, label: "24 px" },
  { value: 32, label: "32 px" },
  { value: 40, label: "40 px" },
  { value: 48, label: "48 px" },
];

const ALIGN_OPTIONS: { value: ColumnsBlockRowAlign; label: string }[] = [
  { value: "start", label: "Top" },
  { value: "center", label: "Middle" },
  { value: "end", label: "Bottom" },
  { value: "stretch", label: "Fill" },
];

const triggerBtnClass =
  "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground";

function ColumnBarsMini({ count, className }: { count: ColumnLayoutCount; className?: string }) {
  return (
    <span className={cn("flex h-3.5 items-end gap-0.5", className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-3 w-[3px] shrink-0 rounded-[1px] bg-current opacity-75" />
      ))}
    </span>
  );
}

export type ColumnsBlockLayoutPatch = Partial<
  Pick<ColumnsBlock, "columnGap" | "rowAlign" | "insetPaddingPx" | "stacks" | "columnFlex">
>;

export function ColumnsBlockLayoutControls({
  block,
  onPatch,
}: {
  block: ColumnsBlock;
  onPatch: (patch: ColumnsBlockLayoutPatch) => void;
}) {
  const gap = block.columnGap ?? "normal";
  const align = block.rowAlign ?? "stretch";
  const inset = block.insetPaddingPx;
  const columnCount = block.stacks.length as ColumnLayoutCount;
  const coercedFlex = coerceColumnFlex(block.stacks.length, block.columnFlex);
  const widthsAlreadyEqual =
    normalizeColumnFlexForStorage(block.stacks.length, coercedFlex) === undefined;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <div className="flex shrink-0 items-center gap-0.5 border-border/60 sm:border-r sm:pr-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={triggerBtnClass} aria-label="Number of columns">
              <LayoutGrid className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              {columnCount} columns
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="min-w-[11rem]" onCloseAutoFocus={(e) => e.preventDefault()}>
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Column count</p>
            {([2, 3, 4] as const).map((n) => (
              <DropdownMenuItem
                key={n}
                className="cursor-pointer gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextStacks = resizeColumnStacks(block.stacks, n);
                  const nextFlex = resizeColumnFlexWithStacks(block.columnFlex, columnCount, n);
                  onPatch({ stacks: nextStacks, columnFlex: nextFlex });
                }}
              >
                {columnCount === n ? <Check className="h-4 w-4 shrink-0 opacity-70" aria-hidden /> : <span className="w-4" />}
                <ColumnBarsMini count={n} className="text-foreground" />
                <span>{n} columns</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          disabled={widthsAlreadyEqual}
          title={widthsAlreadyEqual ? "Columns are already equal width" : "Reset to equal column widths"}
          className={cn(
            triggerBtnClass,
            widthsAlreadyEqual && "cursor-not-allowed opacity-40 hover:border-transparent hover:bg-transparent",
          )}
          aria-label="Equal column widths"
          onClick={(e) => {
            e.stopPropagation();
            if (widthsAlreadyEqual) return;
            onPatch({ columnFlex: undefined });
          }}
        >
          <AlignHorizontalDistributeCenter className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          Equal
        </button>
      </div>

      <div className="flex items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={triggerBtnClass} aria-label="Column spacing">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Spacing
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="min-w-[12rem]" onCloseAutoFocus={(e) => e.preventDefault()}>
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Column gap</p>
            {GAP_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                className="cursor-pointer gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onPatch({ columnGap: opt.value === "normal" ? undefined : opt.value });
                }}
              >
                {gap === opt.value ? <Check className="h-4 w-4 shrink-0 opacity-70" aria-hidden /> : <span className="w-4" />}
                {opt.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inset</p>
            {INSET_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.label}
                className="cursor-pointer gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onPatch({
                    insetPaddingPx: opt.value === null ? undefined : opt.value,
                  });
                }}
              >
                {(opt.value === null ? inset === undefined || inset === 0 : inset === opt.value) ? (
                  <Check className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                ) : (
                  <span className="w-4" />
                )}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(triggerBtnClass, "pl-2")} aria-label="Column alignment">
              <AlignVerticalJustifyCenter className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Align
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="min-w-[10rem]" onCloseAutoFocus={(e) => e.preventDefault()}>
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Row alignment</p>
            {ALIGN_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                className="cursor-pointer gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onPatch({ rowAlign: opt.value === "stretch" ? undefined : opt.value });
                }}
              >
                {align === opt.value ? <Check className="h-4 w-4 shrink-0 opacity-70" aria-hidden /> : <span className="w-4" />}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
