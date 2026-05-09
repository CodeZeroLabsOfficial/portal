"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Palette,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STYLE_PRESET_COLORS, resolveBlockStyle } from "@/lib/block-style";
import { cn } from "@/lib/utils";
import type { BlockStyle } from "@/types/proposal";

export interface BlockToolbarProps {
  /** What kind of block this toolbar is editing — controls which slots show. */
  blockType: "pricing" | "packages" | "section" | "other";
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Optional callback to open a block-specific options panel. When omitted the icon is hidden. */
  onOpenSettings?: () => void;
  /** When the block supports `style` (pricing / packages), pass the current value + setter. */
  style?: BlockStyle;
  onStyleChange?: (next: BlockStyle | undefined) => void;
}

export function BlockToolbar({
  blockType,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onOpenSettings,
  style,
  onStyleChange,
}: BlockToolbarProps) {
  const supportsStyle =
    (blockType === "pricing" || blockType === "packages" || blockType === "section") &&
    typeof onStyleChange === "function";

  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex items-center gap-0.5 rounded-xl border border-zinc-700/40 bg-zinc-900/95 p-1 text-zinc-100 shadow-xl backdrop-blur-sm",
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <ToolbarIconButton
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
        label="Move down"
        disabled={!canMoveDown}
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown();
        }}
      >
        <ArrowDown className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarDivider />
      <ToolbarIconButton
        label="Duplicate"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
      >
        <Copy className="h-4 w-4" />
      </ToolbarIconButton>
      {supportsStyle ? (
        <StylePickerTrigger style={style} onStyleChange={onStyleChange!} />
      ) : null}
      {onOpenSettings ? (
        <ToolbarIconButton
          label="Section options"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
        >
          <Settings2 className="h-4 w-4" />
        </ToolbarIconButton>
      ) : null}
      <ToolbarDivider />
      <ToolbarIconButton
        label="Delete section"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="hover:bg-red-500/20 hover:text-red-300"
      >
        <Trash2 className="h-4 w-4" />
      </ToolbarIconButton>
    </div>
  );
}

function ToolbarIconButton({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-30",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-white/15" aria-hidden />;
}

function StylePickerTrigger({
  style,
  onStyleChange,
}: {
  style?: BlockStyle;
  onStyleChange: (next: BlockStyle | undefined) => void;
}) {
  const resolved = resolveBlockStyle(style);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Section style"
          aria-label="Section style"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 data-[state=open]:bg-white/15 data-[state=open]:text-white"
        >
          <Palette className="h-4 w-4" />
          <span
            className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ring-1 ring-zinc-900"
            style={{ backgroundColor: resolved.primaryColor }}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={8}
        className="w-72 border-zinc-700/60 bg-zinc-900/95 p-0 text-zinc-100"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <StylePickerPanel style={style} onStyleChange={onStyleChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -----------------------------------------------------------------------------
 * Style popover panel — variant tabs + primary/highlight colour pickers.
 * -------------------------------------------------------------------------- */

function StylePickerPanel({
  style,
  onStyleChange,
}: {
  style?: BlockStyle;
  onStyleChange: (next: BlockStyle | undefined) => void;
}) {
  const resolved = resolveBlockStyle(style);

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
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Section style
        </p>
        <div className="mt-2 inline-flex w-full rounded-lg bg-zinc-800/80 p-0.5 ring-1 ring-zinc-700/60">
          <VariantPill
            label="Visual"
            active={resolved.variant === "visual"}
            onClick={() => patch({ variant: "visual" })}
          />
          <VariantPill
            label="Simple"
            active={resolved.variant === "simple"}
            onClick={() => patch({ variant: "simple" })}
          />
        </div>
      </div>

      <ColorRow
        label="Primary color"
        value={resolved.primaryColor}
        onChange={(v) => patch({ primaryColor: v })}
      />

      <ColorRow
        label="Highlight color"
        value={resolved.highlightColor}
        onChange={(v) => patch({ highlightColor: v })}
      />

      <button
        type="button"
        onClick={() => onStyleChange(undefined)}
        className="w-full rounded-md border border-zinc-700/60 bg-transparent px-2 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-400 hover:text-white",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  function commitDraft() {
    const next = normalizeColorInput(draft);
    if (next) onChange(next);
    else setDraft(value);
  }

  return (
    <div>
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </p>
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
                "relative h-8 w-8 rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                isActive ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : "border-zinc-700 hover:scale-105",
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
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/60 p-1.5">
        <span
          className="h-6 w-6 shrink-0 rounded-full ring-1 ring-zinc-700"
          style={{ backgroundColor: value }}
          aria-hidden
        />
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
          className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          aria-label={`${label} hex value`}
          placeholder="#4543F7"
        />
      </div>
    </div>
  );
}

/** True when the swatch is light enough that a dark check icon would disappear. */
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

/** Permits 3- or 6-digit hex (with or without `#`) and CSS named colours up to 32 chars. */
function normalizeColorInput(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^#?[0-9a-fA-F]{3}$/.test(v)) return `#${v.replace("#", "")}`;
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) return `#${v.replace("#", "")}`;
  if (/^[a-zA-Z]{3,32}$/.test(v)) return v.toLowerCase();
  return null;
}
