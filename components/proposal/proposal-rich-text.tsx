"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  ChevronDown,
  ChevronUp,
  Italic,
  Link as LinkIcon,
  List,
  ImageIcon,
  ListOrdered,
  MoreHorizontal,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { PROPOSAL_EDITOR_BUBBLE_TOOLBAR_DARK_SHELL_CLASSES } from "@/lib/proposal-editor-glass";
import { cn } from "@/lib/utils";
import { PROPOSAL_RICH_HEADING_LEVEL_CLASSES } from "@/lib/proposal-rich-heading-typography";
import { PROPOSAL_MERGE_TOKEN_CHOICES } from "@/lib/proposal-merge-token-choices";
import {
  PROPOSAL_FONT_MENU_SECTIONS,
  PROPOSAL_FONT_WEIGHT_OPTIONS,
  normalizeProposalFontFamily,
  proposalFontPreviewFamily,
  resolveProposalFontOption,
} from "@/lib/fonts";
import {
  FontFamily,
  FontSize,
  FontWeight,
  ProposalBlockTypography,
  type ProposalLetterCase,
} from "@/lib/proposal-tiptap-typography";
import { useProposalSectionEditorChrome } from "@/components/proposal/proposal-section-editor-chrome";

interface HeadingOption {
  value: "p" | "h1" | "h2" | "h3" | "h4" | "blockquote";
  label: string;
  shortLabel: string;
}

const HEADING_OPTIONS: HeadingOption[] = [
  { value: "h1", shortLabel: "H1", label: "Title" },
  { value: "h2", shortLabel: "H2", label: "Subtitle" },
  { value: "h3", shortLabel: "H3", label: "Heading" },
  { value: "h4", shortLabel: "H4", label: "Subheading" },
  { value: "p", shortLabel: "T1", label: "Body text" },
  { value: "blockquote", shortLabel: "T2", label: "Pull quote" },
];

function getActiveHeading(editor: Editor): HeadingOption {
  if (editor.isActive("blockquote")) return HEADING_OPTIONS[5];
  for (let i = 0; i < 4; i += 1) {
    const opt = HEADING_OPTIONS[i];
    const level = Number(opt.value.slice(1));
    if (editor.isActive("heading", { level })) return opt;
  }
  return HEADING_OPTIONS[4];
}

function applyHeadingOption(editor: Editor, opt: HeadingOption) {
  const c = editor.chain().focus();
  if (opt.value === "p") {
    c.setParagraph().run();
    return;
  }
  if (opt.value === "blockquote") {
    if (editor.isActive("blockquote")) {
      c.toggleBlockquote().run();
    } else {
      c.setParagraph().toggleBlockquote().run();
    }
    return;
  }
  c.toggleHeading({ level: Number(opt.value.slice(1)) as 1 | 2 | 3 | 4 }).run();
}

const ALIGN_OPTIONS: { value: "left" | "center" | "right"; icon: typeof AlignLeft; label: string }[] = [
  { value: "left", icon: AlignLeft, label: "Left" },
  { value: "center", icon: AlignCenter, label: "Center" },
  { value: "right", icon: AlignRight, label: "Right" },
];

const BUBBLE_MENU_PANEL_SURFACE_CLASS = cn(
  "rounded-md border p-1",
  PROPOSAL_EDITOR_BUBBLE_TOOLBAR_DARK_SHELL_CLASSES,
);

const BUBBLE_MENU_PANEL_CLASS = cn(
  BUBBLE_MENU_PANEL_SURFACE_CLASS,
  "absolute left-0 top-full z-[100] mt-1",
);

const VIEWPORT_EDGE_PAD_PX = 8;

/** Radix dropdowns portal to `document.body`; inside TipTap's Tippy bubble that breaks anchor geometry. Inline panels stay under the trigger. */
function useCloseBubbleToolbarMenu(
  open: boolean,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  containerRef: React.RefObject<HTMLElement | null>,
  extraContainRefs?: React.RefObject<HTMLElement | null>[],
) {
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (el.contains(t)) return;
      for (const extra of extraContainRefs ?? []) {
        if (extra.current?.contains(t)) return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, setOpen, containerRef, extraContainRefs]);
}

function useFixedToolbarMenuPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
  {
    estimatedWidthPx,
    align = "start",
    placement = "below",
  }: {
    estimatedWidthPx?: number;
    align?: "start" | "end";
    placement?: "below" | "above";
  } = {},
) {
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties | null>(null);

  React.useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;

    const updatePosition = () => {
      const tr = trigger.getBoundingClientRect();
      const pr = panelRef.current?.getBoundingClientRect();
      const width = Math.ceil(pr?.width ?? estimatedWidthPx ?? 216);
      const height = Math.ceil(pr?.height ?? 0);

      let left = align === "end" ? tr.right - width : tr.left;
      left = Math.min(
        Math.max(VIEWPORT_EDGE_PAD_PX, left),
        window.innerWidth - width - VIEWPORT_EDGE_PAD_PX,
      );

      const gapPx = 4;
      const spaceBelow = window.innerHeight - VIEWPORT_EDGE_PAD_PX - (tr.bottom + gapPx);
      const spaceAbove = tr.top - gapPx - VIEWPORT_EDGE_PAD_PX;
      const openAbove =
        placement === "above" ||
        (placement === "below" && height > 0 && height > spaceBelow && height <= spaceAbove);

      const style: React.CSSProperties = {
        position: "fixed",
        left,
        top: openAbove ? tr.top - gapPx : tr.bottom + gapPx,
        zIndex: 10000,
      };
      if (estimatedWidthPx != null) style.width = estimatedWidthPx;
      if (openAbove) style.transform = "translateY(-100%)";

      setPanelStyle(style);
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, align, estimatedWidthPx, placement, triggerRef, panelRef]);

  return panelStyle;
}

function ToolbarButton({
  active,
  onClick,
  ariaLabel,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:bg-white/10",
        active && "bg-white/15 text-white",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-white/10" />;
}

function HeadingPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const active = getActiveHeading(editor);
  useCloseBubbleToolbarMenu(open, setOpen, rootRef);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label="Text style"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-zinc-100 transition-colors hover:bg-white/10"
      >
        <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-white/10 text-[11px] font-semibold tabular-nums text-zinc-100">
          {active.shortLabel}
        </span>
        <span className="whitespace-nowrap">{active.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(BUBBLE_MENU_PANEL_CLASS, "min-w-[200px]")}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {HEADING_OPTIONS.map((opt) => {
            const isActive = active.value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-200 outline-none hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white",
                  isActive && "bg-white/10 text-white",
                )}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  applyHeadingOption(editor, opt);
                  setOpen(false);
                }}
              >
                <span
                  className={cn(
                    "inline-block w-7 text-center text-xs font-semibold",
                    isActive ? "text-sky-400" : "text-zinc-400",
                  )}
                >
                  {opt.shortLabel}
                </span>
                <span className="whitespace-nowrap">{opt.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FontFamilyPicker({
  editor,
  layout = "toolbar",
}: {
  editor: Editor;
  layout?: "toolbar" | "menu";
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  useCloseBubbleToolbarMenu(open, setOpen, rootRef);

  const { fontFamilyRaw } = useEditorState({
    editor,
    selector: (snap) => ({
      fontFamilyRaw: snap.editor.getAttributes("textStyle").fontFamily as string | undefined,
    }),
  });

  const active = resolveProposalFontOption(fontFamilyRaw);
  const menuLayout = layout === "menu";

  return (
    <div className={cn("relative", menuLayout && "w-full")} ref={rootRef}>
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label="Font"
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "inline-flex items-center gap-1 rounded text-sm text-zinc-100 transition-colors hover:bg-white/10",
          menuLayout
            ? "h-8 w-full justify-between border border-white/10 bg-white/5 px-2"
            : "max-w-[9.5rem] px-2 py-1",
        )}
      >
        <span
          className="min-w-0 truncate whitespace-nowrap"
          style={
            active.value
              ? { fontFamily: proposalFontPreviewFamily(active.value) ?? active.value }
              : undefined
          }
        >
          {active.label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            BUBBLE_MENU_PANEL_CLASS,
            "min-w-[11rem] max-w-[min(18rem,calc(100vw-2rem))] max-h-[min(50vh,22rem)] overflow-y-auto overflow-x-hidden",
          )}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {PROPOSAL_FONT_MENU_SECTIONS.map((section) => (
            <div key={section.id} role="group" aria-label={section.label}>
              {section.label ? (
                <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 first:pt-1">
                  {section.label}
                </p>
              ) : null}
              {section.items.map((opt) => {
                const isActive =
                  opt.value === ""
                    ? !fontFamilyRaw || normalizeProposalFontFamily(fontFamilyRaw) === ""
                    : normalizeProposalFontFamily(opt.value) ===
                      normalizeProposalFontFamily(fontFamilyRaw);
                const preview = proposalFontPreviewFamily(opt.value);
                return (
                  <button
                    key={`${section.id}-${opt.label}-${opt.value}`}
                    type="button"
                    role="menuitem"
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-200 outline-none hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white",
                      isActive && "bg-white/10 text-white",
                    )}
                    style={preview ? { fontFamily: preview } : undefined}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().setFontFamily(opt.value || null).run();
                      setOpen(false);
                    }}
                  >
                    <span className="whitespace-nowrap">{opt.label}</span>
                    {isActive ? (
                      <span className="text-sky-400" aria-hidden>
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FontSizeControl({ editor }: { editor: Editor }) {
  const { fontSizeRaw } = useEditorState({
    editor,
    selector: (snap) => ({
      fontSizeRaw: snap.editor.getAttributes("textStyle").fontSize as string | undefined,
    }),
  });
  const value = Number(fontSizeRaw ?? 16);
  function clamp(n: number) {
    return Math.max(8, Math.min(120, Math.round(n)));
  }
  function set(next: number) {
    editor.chain().focus().setFontSize(String(clamp(next))).run();
  }
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded text-zinc-200"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <input
        type="number"
        min={8}
        max={120}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n > 0) set(n);
        }}
        className={cn(
          "w-10 rounded bg-transparent px-1 py-0.5 text-center text-sm tabular-nums outline-none focus:bg-white/10",
          "[appearance:textfield] [-moz-appearance:textfield]",
          "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
        aria-label="Font size"
      />
      <span className="flex shrink-0 flex-col">
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => set(value + 1)}
          aria-label="Increase font size"
          className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => set(value - 1)}
          aria-label="Decrease font size"
          className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}

function ColorControl({ editor }: { editor: Editor }) {
  const { colorRaw } = useEditorState({
    editor,
    selector: (snap) => ({
      colorRaw: snap.editor.getAttributes("textStyle").color as string | undefined,
    }),
  });
  const current = colorRaw ?? "#ffffff";
  return (
    <label
      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-zinc-200 transition-colors hover:bg-white/10"
      aria-label="Text color"
      onMouseDown={(e) => e.preventDefault()}
    >
      <span
        className="flex h-4 w-4 items-end justify-center text-xs font-bold leading-none"
        style={{ borderBottom: `3px solid ${current}` }}
      >
        A
      </span>
      <input
        type="color"
        value={current}
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        className="sr-only"
      />
    </label>
  );
}

function AlignmentPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const current =
    ALIGN_OPTIONS.find((a) => editor.isActive({ textAlign: a.value })) ?? ALIGN_OPTIONS[0];
  const Icon = current.icon;
  useCloseBubbleToolbarMenu(open, setOpen, rootRef);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label="Text alignment"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Icon className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(BUBBLE_MENU_PANEL_CLASS, "min-w-[9rem]")}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {ALIGN_OPTIONS.map((a) => {
            const Ic = a.icon;
            const isActive = current.value === a.value;
            return (
              <button
                key={a.value}
                type="button"
                role="menuitem"
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-200 outline-none hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white",
                  isActive && "bg-white/10 text-white",
                )}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setTextAlign(a.value).run();
                  setOpen(false);
                }}
              >
                <Ic className="h-4 w-4 shrink-0" />
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const MERGE_FIELD_PANEL_WIDTH_PX = 340;

function MergeFieldMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelStyle = useFixedToolbarMenuPosition(open, triggerRef, panelRef, {
    estimatedWidthPx: MERGE_FIELD_PANEL_WIDTH_PX,
    align: "end",
    placement: "above",
  });
  useCloseBubbleToolbarMenu(open, setOpen, triggerRef, [panelRef]);

  function insert(snippet: string) {
    editor.chain().focus().insertContent(snippet).run();
    setOpen(false);
  }

  const panel =
    open && panelStyle ? (
      <div
        ref={panelRef}
        role="menu"
        style={panelStyle}
        className="rounded-md border border-zinc-700 bg-zinc-900 p-1 text-zinc-100 shadow-lg"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          CRM merge tokens
        </p>
        <div className="max-h-[min(70vh,24rem)] overflow-y-auto overscroll-y-contain">
          {PROPOSAL_MERGE_TOKEN_CHOICES.map((opt) => (
            <button
              key={opt.insert}
              type="button"
              role="menuitem"
              className="flex w-full rounded px-2 py-1.5 text-left text-[13px] leading-snug outline-none hover:bg-white/10 focus-visible:bg-white/10"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => insert(opt.insert)}
            >
              <span className="text-zinc-100">
                {opt.label}: <span className="text-sky-300/90">{opt.insert}</span>
                {opt.description ? (
                  <span className="text-zinc-500"> — {opt.description}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label="Insert merge field"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-600 bg-transparent text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Braces className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      </button>
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const active = editor.isActive("link");
  return (
    <ToolbarButton
      active={active}
      ariaLabel="Link"
      onClick={() => {
        const existing = (editor.getAttributes("link").href as string | undefined) ?? "";
        const next = window.prompt("Link URL", existing);
        if (next === null) return;
        const url = next.trim();
        if (!url) {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }}
    >
      <LinkIcon className="h-4 w-4" />
    </ToolbarButton>
  );
}

function roundTypography(n: number, decimals = 2) {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

const TYPOGRAPHY_NUMERIC_INPUT_CLASS = cn(
  "min-w-0 flex-1 bg-transparent px-2 text-sm tabular-nums text-zinc-100 outline-none",
  "[appearance:textfield] [-moz-appearance:textfield]",
  "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
);

function TypographyNumericField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  function clamp(n: number) {
    return Math.min(max, Math.max(min, roundTypography(n)));
  }
  return (
    <div className="space-y-1">
      <span className="block text-xs text-zinc-400">{label}</span>
      <div
        className="flex h-8 items-center rounded border border-white/10 bg-white/5 pr-0.5"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
          className={TYPOGRAPHY_NUMERIC_INPUT_CLASS}
          aria-label={label}
        />
        <span className="flex shrink-0 flex-col">
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onChange(clamp(value + step))}
            aria-label={`Increase ${label}`}
            className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onChange(clamp(value - step))}
            aria-label={`Decrease ${label}`}
            className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </span>
      </div>
    </div>
  );
}

const TYPOGRAPHY_MORE_MENU_WIDTH_PX = 216;

function TypographyMoreMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelStyle = useFixedToolbarMenuPosition(open, triggerRef, panelRef, {
    estimatedWidthPx: TYPOGRAPHY_MORE_MENU_WIDTH_PX,
    align: "end",
    placement: "below",
  });
  useCloseBubbleToolbarMenu(open, setOpen, triggerRef, [panelRef]);

  const state = useEditorState({
    editor,
    selector: (snap) => {
      const parent = snap.editor.state.selection.$from.parent;
      const blockType = parent.type.name;
      const canEditBlock = blockType === "paragraph" || blockType === "heading" || blockType === "blockquote";
      return {
        canEditBlock,
        lineHeight: parent.attrs.lineHeight as string | null | undefined,
        marginTop: parent.attrs.marginTop as string | null | undefined,
        marginBottom: parent.attrs.marginBottom as string | null | undefined,
        letterSpacing: parent.attrs.letterSpacing as string | null | undefined,
        letterCase: (parent.attrs.letterCase as ProposalLetterCase | null | undefined) ?? null,
        fontWeightRaw: snap.editor.getAttributes("textStyle").fontWeight as string | undefined,
      };
    },
  });

  const lineHeight = Number(state.lineHeight ?? 1.3);
  const marginTop = Number(state.marginTop ?? 0);
  const marginBottom = Number(state.marginBottom ?? 0);
  const letterSpacing = Number(state.letterSpacing ?? 0);
  const letterCase = state.letterCase ?? "none";
  const fontWeight = state.fontWeightRaw ?? "";

  const panel =
    open && panelStyle ? (
      <div
        ref={panelRef}
        role="menu"
        style={panelStyle}
        className={cn(BUBBLE_MENU_PANEL_SURFACE_CLASS, "min-w-[13.5rem] space-y-2.5 p-2")}
        onPointerDown={(e) => e.stopPropagation()}
      >
          <div className="space-y-1">
            <span className="block text-xs text-zinc-400">Font</span>
            <FontFamilyPicker editor={editor} layout="menu" />
          </div>

          <div className="space-y-1">
            <label htmlFor="proposal-rich-font-weight" className="block text-xs text-zinc-400">
              Font weight
            </label>
            <select
              id="proposal-rich-font-weight"
              value={fontWeight}
              onChange={(e) => {
                const v = e.target.value;
                editor.chain().focus().setFontWeight(v || null).run();
              }}
              className="h-8 w-full rounded border border-white/10 bg-white/5 px-2 text-sm text-zinc-100 outline-none focus:bg-white/10"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {PROPOSAL_FONT_WEIGHT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value} className="bg-zinc-900 text-zinc-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {state.canEditBlock ? (
            <>
              <TypographyNumericField
                label="Line height"
                value={lineHeight}
                min={0.8}
                max={3}
                step={0.05}
                onChange={(n) => editor.chain().focus().setBlockLineHeight(String(n)).run()}
              />
              <TypographyNumericField
                label="Letter spacing"
                value={letterSpacing}
                min={-0.2}
                max={0.5}
                step={0.01}
                onChange={(n) =>
                  editor.chain().focus().setBlockLetterSpacing(n === 0 ? "0" : String(n)).run()
                }
              />
              <div className="space-y-1">
                <span className="block text-xs text-zinc-400">Letter case</span>
                <div className="flex h-8 overflow-hidden rounded border border-white/10">
                  <button
                    type="button"
                    aria-pressed={letterCase !== "uppercase"}
                    className={cn(
                      "flex-1 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10",
                      letterCase !== "uppercase" && "bg-white/15 text-white",
                    )}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().setBlockLetterCase("none").run()}
                  >
                    Ag
                  </button>
                  <button
                    type="button"
                    aria-pressed={letterCase === "uppercase"}
                    className={cn(
                      "flex-1 border-l border-white/10 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10",
                      letterCase === "uppercase" && "bg-white/15 text-white",
                    )}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().setBlockLetterCase("uppercase").run()}
                  >
                    AG
                  </button>
                </div>
              </div>
              <TypographyNumericField
                label="Top spacing"
                value={marginTop}
                min={0}
                max={5}
                step={0.05}
                onChange={(n) => editor.chain().focus().setBlockMarginTop(String(n)).run()}
              />
              <TypographyNumericField
                label="Bottom spacing"
                value={marginBottom}
                min={0}
                max={5}
                step={0.05}
                onChange={(n) => editor.chain().focus().setBlockMarginBottom(String(n)).run()}
              />
            </>
          ) : (
            <p className="px-1 text-xs leading-snug text-zinc-500">
              Place the cursor in a paragraph or heading to adjust spacing.
            </p>
          )}
      </div>
    ) : null;

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label="More typography options"
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:bg-white/10",
          open && "bg-white/15 text-white",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

export interface ProposalRichTextProps {
  /** Initial HTML; remount the component (key) when switching blocks. */
  html: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * `header`: show the font bubble when the caret is inside a heading even with no
   * text selected (heading blocks use a single line where selection is often empty).
   */
  variant?: "default" | "header";
  /** When set, overrides the compact default minimum height of the editable surface (px). */
  editorMinHeightPx?: number;
  onEditorMinHeightPxChange?: (next: number | undefined) => void;
  /** Show a bottom-right drag handle to change `editorMinHeightPx` (text blocks in the builder). */
  resizableHeight?: boolean;
  /** When true (default), the formatting bubble only appears for a non-empty text selection. */
  bubbleMenuRequiresTextSelection?: boolean;
}

const TEXT_EDITOR_RESIZE_MIN_PX = 52;
const TEXT_EDITOR_RESIZE_MAX_PX = 1600;

const TIPTAP_PROSE_TYPOGRAPHY = cn(
  "outline-none [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
  PROPOSAL_RICH_HEADING_LEVEL_CLASSES,
);

function TextEditorResizeHandle({
  shellRef,
  onHeightChange,
}: {
  shellRef: React.RefObject<HTMLDivElement | null>;
  onHeightChange: (px: number | undefined) => void;
}) {
  const dragRef = React.useRef<{ startY: number; startH: number } | null>(null);

  return (
    <button
      type="button"
      aria-label="Resize text block height"
      title="Drag to change height · double-click to reset"
      className="absolute bottom-0.5 right-0.5 z-[5] flex h-6 w-6 cursor-nwse-resize touch-none items-end justify-end rounded-sm p-0.5 text-muted-foreground opacity-70 transition-opacity hover:bg-accent/70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const shell = shellRef.current;
        if (!shell) return;
        e.preventDefault();
        dragRef.current = { startY: e.clientY, startH: shell.getBoundingClientRect().height };
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d) return;
        const next = Math.round(d.startH + (e.clientY - d.startY));
        const clamped = Math.min(TEXT_EDITOR_RESIZE_MAX_PX, Math.max(TEXT_EDITOR_RESIZE_MIN_PX, next));
        onHeightChange(clamped);
      }}
      onPointerUp={(e) => {
        dragRef.current = null;
        try {
          (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
        } catch {
          /* released */
        }
      }}
      onPointerCancel={(e) => {
        dragRef.current = null;
        try {
          (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
        } catch {
          /* released */
        }
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        onHeightChange(undefined);
      }}
    >
      <span
        className="pointer-events-none mb-px mr-px block h-2.5 w-2.5 rounded-br border-b-[2.5px] border-r-[2.5px] border-current opacity-90"
        aria-hidden
      />
    </button>
  );
}

export function ProposalRichText({
  html,
  onChange,
  placeholder,
  className,
  variant = "default",
  editorMinHeightPx,
  onEditorMinHeightPxChange,
  resizableHeight = false,
  bubbleMenuRequiresTextSelection = true,
}: ProposalRichTextProps) {
  const sectionChrome = useProposalSectionEditorChrome();
  const seamless = sectionChrome?.seamless ?? false;
  const prefersLight = sectionChrome?.prefersLight ?? false;
  const headerVariant = variant === "header";

  const shellRef = React.useRef<HTMLDivElement | null>(null);

  const resolvedMinHeightPx =
    editorMinHeightPx != null && Number.isFinite(editorMinHeightPx)
      ? Math.min(TEXT_EDITOR_RESIZE_MAX_PX, Math.max(TEXT_EDITOR_RESIZE_MIN_PX, Math.round(editorMinHeightPx)))
      : null;

  const autoMinHeightClass = seamless
    ? headerVariant
      ? "min-h-[2rem]"
      : "min-h-[2.75rem]"
    : headerVariant
      ? "min-h-[3.5rem]"
      : "min-h-[3.25rem]";
  const editorMinHeightStyle =
    resolvedMinHeightPx != null ? (`min-height: ${resolvedMinHeightPx}px` as const) : undefined;

  // No focus ring/border on the editable surface itself — block-level chrome
  // (toolbar + outline) already conveys selection. Browser-default outline is
  // suppressed via `focus-within:outline-none` so removing the ring doesn't
  // expose it.
  const editorRootClass = cn(
    TIPTAP_PROSE_TYPOGRAPHY,
    seamless
      ? cn(
          "proposal-rich-text max-w-none rounded-none border-0 bg-transparent px-2.5 py-1.5 text-sm leading-relaxed shadow-none focus-within:outline-none",
          // Stay visually merged with the section band (no hover/focus panel tint).
          "!bg-transparent hover:!bg-transparent focus:!bg-transparent focus-within:!bg-transparent active:!bg-transparent",
          "dark:!bg-transparent dark:hover:!bg-transparent dark:focus:!bg-transparent dark:focus-within:!bg-transparent",
          resolvedMinHeightPx == null ? autoMinHeightClass : null,
          prefersLight
            ? "text-white/[0.92] [&_a]:text-sky-200 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-white/25 [&_blockquote]:pl-4 [&_blockquote]:italic"
            : "text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic",
        )
      : cn(
          "proposal-rich-text max-w-none rounded-lg border-0 bg-background px-2.5 py-1.5 text-sm leading-relaxed text-foreground focus-within:outline-none",
          resolvedMinHeightPx == null ? autoMinHeightClass : null,
          "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:text-primary [&_a]:underline",
        ),
    className,
  );

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      FontSize,
      FontFamily,
      FontWeight,
      ProposalBlockTypography,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Image.configure({
        inline: true,
        allowBase64: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Write your section…" }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: html?.trim() ? html : "<p></p>",
    editorProps: {
      attributes: {
        class: editorRootClass,
        style: editorMinHeightStyle ?? "",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: editorRootClass,
          style: editorMinHeightStyle ?? "",
        },
      },
    });
  }, [editor, editorRootClass, editorMinHeightStyle]);

  if (!editor) {
    return (
      <div
        className={cn(
          "proposal-rich-text-skel animate-pulse rounded-lg",
          resolvedMinHeightPx == null ? autoMinHeightClass : null,
          // Inside a section the surface stays the section's chosen colour — any
          // skeleton tint reads as a coloured rectangle layered on top, which
          // looked like the editor itself had a different fill.
          seamless ? "bg-transparent" : "bg-muted/40",
        )}
        style={resolvedMinHeightPx != null ? { minHeight: resolvedMinHeightPx } : undefined}
      />
    );
  }

  const showResize =
    resizableHeight && !headerVariant && typeof onEditorMinHeightPxChange === "function";

  return (
    <div className="relative" ref={shellRef}>
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 80,
          placement: "top",
          maxWidth: 720,
          popperOptions: {
            modifiers: [
              { name: "preventOverflow", options: { padding: VIEWPORT_EDGE_PAD_PX, altAxis: true } },
              { name: "flip", options: { fallbackPlacements: ["bottom", "top"] } },
            ],
          },
        }}
        shouldShow={({ editor: ed, from, to }) => {
          if (!ed.isEditable) return false;
          if (bubbleMenuRequiresTextSelection) return from !== to;
          if (from !== to) return true;
          if (headerVariant && ed.isActive("heading")) return true;
          return ed.isFocused;
        }}
      >
        <div
          className={cn(
            "flex items-center gap-0.5 rounded-lg border p-1",
            PROPOSAL_EDITOR_BUBBLE_TOOLBAR_DARK_SHELL_CLASSES,
          )}
        >
          <HeadingPicker editor={editor} />
          <ToolbarDivider />
          <FontSizeControl editor={editor} />
          <ToolbarDivider />
          <ColorControl editor={editor} />
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            ariaLabel="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            ariaLabel="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            ariaLabel="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            ariaLabel="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <AlignmentPicker editor={editor} />
          <LinkButton editor={editor} />
          <ToolbarDivider />
          <MergeFieldMenu editor={editor} />
          <ToolbarButton
            ariaLabel="Image from URL"
            onClick={() => {
              const next = window.prompt("Image URL (https)", "https://");
              if (next === null) return;
              const url = next.trim();
              if (!url || !/^https:\/\//i.test(url)) return;
              editor.chain().focus().setImage({ src: url, alt: "" }).run();
            }}
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            ariaLabel="Bulleted list"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            ariaLabel="Numbered list"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            ariaLabel="Pull quote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <TypographyMoreMenu editor={editor} />
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} />
      {showResize ? (
        <TextEditorResizeHandle shellRef={shellRef} onHeightChange={onEditorMinHeightPxChange} />
      ) : null}
    </div>
  );
}
