"use client";

import * as React from "react";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react";
import { Extension } from "@tiptap/core";
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
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROPOSAL_MERGE_TOKEN_CHOICES } from "@/lib/proposal-template-tokens";
import { useProposalSectionEditorChrome } from "@/components/proposal/proposal-section-editor-chrome";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string | null) => ReturnType;
    };
  }
}

/**
 * Custom mark extension that adds a `fontSize` attribute to TipTap's TextStyle mark
 * so we can store inline font-size styling alongside color etc. — TipTap v2 doesn't
 * ship an official font-size extension, so we attach the attribute here.
 */
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => {
              const m = (el as HTMLElement).style.fontSize?.match(/^(\d+(?:\.\d+)?)px$/);
              return m ? m[1] : null;
            },
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}px` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) => {
          if (size === null) {
            return chain()
              .setMark("textStyle", { fontSize: null })
              .removeEmptyTextStyle()
              .run();
          }
          return chain().setMark("textStyle", { fontSize: size }).run();
        },
    };
  },
});

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

const BUBBLE_MENU_PANEL_CLASS =
  "absolute left-0 top-full z-[100] mt-1 rounded-md border border-zinc-700 bg-zinc-900 p-1 text-zinc-100 shadow-lg";

/** Radix dropdowns portal to `document.body`; inside TipTap's Tippy bubble that breaks anchor geometry. Inline panels stay under the trigger. */
function useCloseBubbleToolbarMenu(
  open: boolean,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const t = e.target;
      if (t instanceof Node && !el.contains(t)) setOpen(false);
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
  }, [open, setOpen, containerRef]);
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
        <span>{active.label}</span>
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
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FontSizeControl({ editor }: { editor: Editor }) {
  const current = editor.getAttributes("textStyle").fontSize as string | undefined;
  const value = Number(current ?? 16);
  function clamp(n: number) {
    return Math.max(8, Math.min(120, Math.round(n)));
  }
  function set(next: number) {
    editor.chain().focus().setFontSize(String(clamp(next))).run();
  }
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded text-zinc-200"
      onMouseDown={(e) => e.stopPropagation()}
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
        className="w-10 rounded bg-transparent px-1 py-0.5 text-center text-sm tabular-nums outline-none focus:bg-white/10"
        aria-label="Font size"
      />
      <span className="flex flex-col">
        <button
          type="button"
          onClick={() => set(value + 1)}
          aria-label="Increase font size"
          className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
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
  const current = (editor.getAttributes("textStyle").color as string | undefined) ?? "#ffffff";
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

function MergeFieldMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  useCloseBubbleToolbarMenu(open, setOpen, rootRef);

  function insert(snippet: string) {
    editor.chain().focus().insertContent(snippet).run();
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
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
      {open ? (
        <div
          role="menu"
          className={cn(BUBBLE_MENU_PANEL_CLASS, "left-auto right-0 min-w-[260px]")}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-white/10 px-2 pb-2 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">CRM merge tokens</p>
            <p className="mt-1 text-[11px] leading-snug text-zinc-400">
              Insert placeholders — replaced when generating a proposal from a customer or opportunity.
            </p>
          </div>
          <div className="max-h-[min(50vh,20rem)] overflow-y-auto p-1">
            {PROPOSAL_MERGE_TOKEN_CHOICES.map((opt) => (
              <button
                key={opt.insert}
                type="button"
                role="menuitem"
                className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left outline-none hover:bg-white/10 focus-visible:bg-white/10"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => insert(opt.insert)}
              >
                <span className="text-[13px] font-medium leading-tight text-zinc-100">{opt.label}</span>
                <code className="mt-0.5 text-[11px] text-sky-300/90">{opt.insert}</code>
                {opt.hint ? <span className="mt-1 text-[10px] leading-snug text-zinc-500">{opt.hint}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
}

const TIPTAP_PROSE_TYPOGRAPHY =
  "[&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none [&_p]:mb-2 [&_h1]:my-3 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:my-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:my-2 [&_h4]:text-base [&_h4]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5";

export function ProposalRichText({
  html,
  onChange,
  placeholder,
  className,
  variant = "default",
}: ProposalRichTextProps) {
  const sectionChrome = useProposalSectionEditorChrome();
  const seamless = sectionChrome?.seamless ?? false;
  const prefersLight = sectionChrome?.prefersLight ?? false;
  const headerVariant = variant === "header";

  // Header blocks render a single-line title and don't need the body-text 140px
  // tall-frame; consumers tried to override via `[&_.ProseMirror]:min-h-[3.5rem]`
  // but that selector requires `.ProseMirror` to be a descendant — and TipTap
  // applies `editorProps.attributes.class` to the `.ProseMirror` element itself,
  // so the override silently never matched. Pick the right base here instead.
  const minHeightClass = headerVariant ? "min-h-[3.5rem]" : "min-h-[140px]";

  // No focus ring/border on the editable surface itself — block-level chrome
  // (toolbar + outline) already conveys selection. Browser-default outline is
  // suppressed via `focus-within:outline-none` so removing the ring doesn't
  // expose it.
  const editorRootClass = cn(
    TIPTAP_PROSE_TYPOGRAPHY,
    seamless
      ? cn(
          "proposal-rich-text max-w-none rounded-none border-0 bg-transparent px-3 py-2 text-sm leading-relaxed shadow-none outline-none focus-within:outline-none",
          // Stay visually merged with the section band (no hover/focus panel tint).
          "!bg-transparent hover:!bg-transparent focus:!bg-transparent focus-within:!bg-transparent active:!bg-transparent",
          "dark:!bg-transparent dark:hover:!bg-transparent dark:focus:!bg-transparent dark:focus-within:!bg-transparent",
          minHeightClass,
          prefersLight
            ? "text-white/[0.92] [&_a]:text-sky-200 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-white/25 [&_blockquote]:pl-4 [&_blockquote]:italic"
            : "text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic",
        )
      : cn(
          "proposal-rich-text max-w-none rounded-lg border-0 bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus-within:outline-none",
          minHeightClass,
          "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:text-primary [&_a]:underline",
        ),
    className,
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Image.configure({
        inline: true,
        allowBase64: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Write your section…" }),
    ],
    content: html?.trim() ? html : "<p></p>",
    editorProps: {
      attributes: {
        class: editorRootClass,
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
        },
      },
    });
  }, [editor, editorRootClass]);

  if (!editor) {
    return (
      <div
        className={cn(
          "proposal-rich-text-skel animate-pulse rounded-lg",
          minHeightClass,
          // Inside a section the surface stays the section's chosen colour — any
          // skeleton tint reads as a coloured rectangle layered on top, which
          // looked like the editor itself had a different fill.
          seamless ? "bg-transparent" : "bg-muted/40",
        )}
      />
    );
  }

  return (
    <div className="relative">
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 80, placement: "top", maxWidth: 720 }}
        shouldShow={({ editor: ed, from, to }) => {
          if (!ed.isEditable) return false;
          if (from !== to) return true;
          if (headerVariant && ed.isActive("heading")) return true;
          return ed.isFocused;
        }}
      >
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950/95 p-1 text-zinc-100 shadow-2xl backdrop-blur">
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
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
