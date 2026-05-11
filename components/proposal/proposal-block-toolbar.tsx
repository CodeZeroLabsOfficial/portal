"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  EllipsisVertical,
  Palette,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STYLE_PRESET_COLORS, resolveBlockStyle } from "@/lib/block-style";
import { cn } from "@/lib/utils";
import type { BlockStyle } from "@/types/proposal";

export interface BlockToolbarProps {
  /** Controls palette + icon treatments. `elevated` is a dark floating bar; `surface` is a soft light pill aligned with editorial chrome. */
  appearance?: "elevated" | "surface";
  blockType: "pricing" | "packages" | "section" | "other";
  deleteLabel?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Optional control rendered at the start of the pill (e.g. drag handle on the left). */
  leadingSlot?: React.ReactNode;
  /** More menu (ellipsis) — hides when false. Duplicate/delete stay on the pill for speed. */
  showOverflowMenu?: boolean;
  /** Optional trailing control inside the pill (e.g. drag handle with sortable listeners). */
  trailingSlot?: React.ReactNode;
  /** Optional toggle shown after the overflow menu — used for reversible layout previews. */
  auxiliarySlot?: React.ReactNode;
  /**
   * Shown as the first item in the overflow menu (before Duplicate). Used e.g. for
   * removing the Plans add-ons sub-table without deleting the whole block.
   */
  overflowLeadingAction?: { label: string; onClick: () => void };
  onOpenSettings?: () => void;
  style?: BlockStyle;
  onStyleChange?: (next: BlockStyle | undefined) => void;
  backdropPickerSlot?: React.ReactNode;
  /**
   * When true, only leading slot → primary slot → delete → trailing slot (omit move /
   * duplicate / overflow chrome). Used for Columns blocks.
   */
  compactChrome?: boolean;
  /** Inserted between leading area and Delete when compactChrome — e.g. “Edit columns”. */
  compactPrimarySlot?: React.ReactNode;
}

export function BlockToolbar({
  appearance = "surface",
  blockType,
  deleteLabel = "Delete block",
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  showOverflowMenu = true,
  leadingSlot,
  trailingSlot,
  auxiliarySlot,
  overflowLeadingAction,
  onOpenSettings,
  style,
  onStyleChange,
  backdropPickerSlot,
  compactChrome = false,
  compactPrimarySlot,
}: BlockToolbarProps) {
  const supportsStyle = blockType === "packages" && typeof onStyleChange === "function";

  const elevated = appearance === "elevated";
  const shell = elevated
    ? "border-zinc-700/40 bg-zinc-900/95 text-zinc-100 shadow-xl"
    : "border-border/70 bg-muted/95 text-foreground shadow-sm ring-1 ring-black/[0.04] backdrop-blur-sm dark:bg-zinc-800/95 dark:ring-white/10";
  const iconBtnBase = elevated
    ? "text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:ring-white/40"
    : "text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring";

  return (
    <div
      className={cn("pointer-events-auto inline-flex items-center gap-0.5 rounded-full p-1", shell)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {leadingSlot ? (
        <>
          <span className="inline-flex items-center">{leadingSlot}</span>
          <ToolbarDivider elevated={elevated} />
        </>
      ) : null}
      {compactChrome ? (
        <>
          {compactPrimarySlot ? (
            <span className="inline-flex items-center gap-1">{compactPrimarySlot}</span>
          ) : null}
          <ToolbarDivider elevated={elevated} />
        </>
      ) : (
        <>
          {showOverflowMenu ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    title="More"
                    aria-label="More actions"
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2",
                      iconBtnBase,
                    )}
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={6} className="min-w-[10rem]" onCloseAutoFocus={(e) => e.preventDefault()}>
                  {overflowLeadingAction ? (
                    <>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          overflowLeadingAction.onClick();
                        }}
                      >
                        {overflowLeadingAction.label}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate();
                    }}
                  >
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    {deleteLabel}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ToolbarDivider elevated={elevated} />
            </>
          ) : null}
          {backdropPickerSlot ? (
            <>
              <span className="inline-flex items-center">{backdropPickerSlot}</span>
              <ToolbarDivider elevated={elevated} />
            </>
          ) : null}
          {auxiliarySlot ? (
            <>
              <span className="inline-flex items-center">{auxiliarySlot}</span>
              <ToolbarDivider elevated={elevated} />
            </>
          ) : null}
          <ToolbarIconButton
            elevated={elevated}
            label="Move up"
            disabled={!canMoveUp}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
          >
            <ArrowUp className="h-4 w-4" />
          </ToolbarIconButton>
          <ToolbarIconButton
            elevated={elevated}
            label="Move down"
            disabled={!canMoveDown}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
          >
            <ArrowDown className="h-4 w-4" />
          </ToolbarIconButton>
          <ToolbarDivider elevated={elevated} />
          <ToolbarIconButton
            elevated={elevated}
            label="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy className="h-4 w-4" />
          </ToolbarIconButton>
          {supportsStyle ? (
            <StylePickerTrigger style={style} onStyleChange={onStyleChange!} elevated={elevated} />
          ) : null}
          {onOpenSettings ? (
            <ToolbarIconButton
              elevated={elevated}
              label="Block options"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
            >
              <Settings2 className="h-4 w-4" />
            </ToolbarIconButton>
          ) : null}
          <ToolbarDivider elevated={elevated} />
        </>
      )}
      <ToolbarIconButton
        elevated={elevated}
        label={deleteLabel}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={
          elevated
            ? "hover:bg-red-500/20 hover:text-red-300"
            : "text-destructive hover:bg-red-500/15 hover:text-destructive"
        }
      >
        <Trash2 className="h-4 w-4" />
      </ToolbarIconButton>
      {trailingSlot ? (
        <>
          <ToolbarDivider elevated={elevated} />
          <span className="inline-flex items-center">{trailingSlot}</span>
        </>
      ) : null}
    </div>
  );
}

function ToolbarIconButton({
  elevated,
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  elevated: boolean;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const base =
    elevated
      ? "text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:ring-white/40"
      : "text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-30",
        base,
        className,
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider({ elevated }: { elevated: boolean }) {
  return (
    <span
      className={cn("mx-0.5 h-5 w-px", elevated ? "bg-white/15" : "bg-border")}
      aria-hidden
    />
  );
}

function StylePickerTrigger({
  style,
  onStyleChange,
  elevated,
}: {
  style?: BlockStyle;
  onStyleChange: (next: BlockStyle | undefined) => void;
  elevated: boolean;
}) {
  const resolved = resolveBlockStyle(style);
  const triggerCn = elevated
    ? "text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:ring-white/40 data-[state=open]:bg-white/15"
    : "text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring data-[state=open]:bg-background";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Style"
          aria-label="Style"
          className={cn(
            "relative inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2",
            triggerCn,
          )}
        >
          <Palette className="h-4 w-4" />
          <span
            className={cn(
              "absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ring-1",
              elevated ? "ring-zinc-900" : "ring-background",
            )}
            style={{ backgroundColor: resolved.primaryColor }}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={8}
        className={cn(
          "w-72 p-0",
          elevated ? "border-zinc-700/60 bg-zinc-900/95 text-zinc-100" : "border border-border bg-popover text-popover-foreground shadow-md",
        )}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <StylePickerPanel style={style} onStyleChange={onStyleChange} elevated={elevated} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StylePickerPanel({
  style,
  onStyleChange,
  elevated,
}: {
  style?: BlockStyle;
  onStyleChange: (next: BlockStyle | undefined) => void;
  elevated: boolean;
}) {
  const resolved = resolveBlockStyle(style);
  const labelMuted = elevated ? "text-zinc-400" : "text-muted-foreground";
  const frame = elevated ? "bg-zinc-800/80 ring-zinc-700/60" : "bg-muted/60 ring-border";

  function patch(next: Partial<BlockStyle>) {
    const merged: BlockStyle = {
      variant: resolved.variant,
      primaryColor: resolved.primaryColor,
      highlightColor: resolved.highlightColor,
      ...style,
      ...next,
    };
    onStyleChange(merged);
  }

  return (
    <div className="space-y-4 p-3">
      <div>
        <p className={cn("px-1 text-[11px] font-semibold uppercase tracking-wider", labelMuted)}>Presentation</p>
        <div className={cn("mt-2 inline-flex w-full rounded-lg p-0.5 ring-1", frame)}>
          <VariantPill
            label="Visual"
            active={resolved.variant === "visual"}
            onClick={() => patch({ variant: "visual" })}
            elevated={elevated}
          />
          <VariantPill
            label="Simple"
            active={resolved.variant === "simple"}
            onClick={() => patch({ variant: "simple" })}
            elevated={elevated}
          />
        </div>
      </div>

      <ColorRow
        elevated={elevated}
        label="Primary color"
        value={resolved.primaryColor}
        onChange={(v) => patch({ primaryColor: v })}
      />

      <ColorRow
        elevated={elevated}
        label="Highlight color"
        value={resolved.highlightColor}
        onChange={(v) => patch({ highlightColor: v })}
      />

      <button
        type="button"
        onClick={() => onStyleChange(undefined)}
        className={cn(
          "w-full rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors",
          elevated ? "border-zinc-700/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200" : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        Reset to default
      </button>
    </div>
  );
}

function VariantPill({
  label,
  active,
  onClick,
  elevated,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  elevated: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        elevated
          ? active
            ? "bg-zinc-700 text-white shadow-sm"
            : "text-zinc-400 hover:text-white"
          : active
            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
            : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function ColorRow({
  elevated,
  label,
  value,
  onChange,
}: {
  elevated: boolean;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const labelMuted = elevated ? "text-zinc-400" : "text-muted-foreground";
  const ringActive = elevated ? "ring-offset-zinc-900" : "ring-offset-background";
  const swatchIdle = elevated ? "border-zinc-700 hover:scale-105" : "border-border hover:scale-105";
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  function commitDraft() {
    const next = normalizeColorInput(draft);
    if (next) onChange(next);
    else setDraft(value);
  }

  return (
    <div>
      <p className={cn("px-1 text-[11px] font-semibold uppercase tracking-wider", labelMuted)}>{label}</p>
      <div className="mt-2 grid grid-cols-6 gap-2">
        {STYLE_PRESET_COLORS.map((c) => {
          const isActive = sameColor(c.value, value);
          return (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              title={c.label}
              onClick={() => onChange(c.value)}
              className={cn(
                "relative h-8 w-8 rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? cn("ring-2 ring-ring ring-offset-2", ringActive) : swatchIdle,
              )}
              style={{ backgroundColor: c.value }}
            >
              {isActive ? (
                <Check
                  className={cn(
                    "absolute inset-0 m-auto h-4 w-4",
                    needsLightCheck(c.value) ? "text-white" : "text-zinc-900",
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className={cn("mt-2 flex items-center gap-2 rounded-lg border p-1.5", elevated ? "border-zinc-700/60 bg-zinc-800/60" : "border-border bg-muted/40")}>
        <span className={cn("h-6 w-6 shrink-0 rounded-full ring-1", elevated ? "ring-zinc-700" : "ring-border")} style={{ backgroundColor: value }} aria-hidden />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          spellCheck={false}
          className={cn("w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", elevated ? "text-zinc-100" : "text-foreground")}
          aria-label={`${label} hex value`}
          placeholder="#4543F7"
        />
      </div>
    </div>
  );
}

function needsLightCheck(hex: string): boolean {
  if (hex.toUpperCase() === "#FFFFFF" || hex.toUpperCase() === "#FFF") return false;
  if (hex.toUpperCase() === "#E2E8F0") return false;
  return true;
}

function sameColor(a: string, b: string): boolean {
  return normalizeHex(a) === normalizeHex(b);
}

function normalizeHex(input: string): string {
  return input.trim().toLowerCase();
}

function normalizeColorInput(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^#?[0-9a-fA-F]{3}$/.test(v)) return `#${v.replace("#", "")}`;
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) return `#${v.replace("#", "")}`;
  if (/^[a-zA-Z]{3,32}$/.test(v)) return v.toLowerCase();
  return null;
}
