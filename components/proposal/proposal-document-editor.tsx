"use client";

import * as React from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  CreditCard,
  ExternalLink,
  GripVertical,
  Heading,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  ListTree,
  Loader2,
  Minus,
  MonitorPlay,
  MoveVertical,
  Mountain,
  Package,
  Pencil,
  PenLine,
  Plus,
  Save,
  ScrollText,
  Send,
  SeparatorHorizontal,
  SquarePen,
  Star,
  type LucideIcon,
} from "lucide-react";
import type {
  AccordionBlock,
  BlockStyle,
  ColumnsBlock,
  FormBlock,
  FormField,
  HeaderBlock,
  IconBlock,
  ImageBlock,
  PackagesBlock,
  PricingBlock,
  ProposalBlock,
  ProposalColumnChildBlock,
  ProposalContentBlock,
  ProposalDocument,
  SectionBackground,
  SectionBlock,
  SignatureBlock,
  SpacerBlock,
  SplashBlock,
  TextBlock,
  VideoBlock,
} from "@/types/proposal";
import { ProposalRichText } from "@/components/proposal/proposal-rich-text";
import { ProposalDocumentView } from "@/components/proposal/proposal-document-view";
import { ProposalSectionShell } from "@/components/proposal/proposal-section-shell";
import { ProposalSectionBackgroundPicker } from "@/components/proposal/proposal-section-background-picker";
import { useProposalSectionEditorChrome } from "@/components/proposal/proposal-section-editor-chrome";
import {
  PackagesInlineEditor,
  PricingInlineEditor,
} from "@/components/proposal/proposal-block-inline-editors";
import { BlockToolbar } from "@/components/proposal/proposal-block-toolbar";
import { DeleteProposalTemplateButton } from "@/components/proposal/delete-proposal-template-button";
import { ColumnsBlockLayoutControls } from "@/components/proposal/columns-block-layout-controls";
import {
  clampFr,
  ColumnLayoutCount,
  coerceColumnFlex,
  columnFlexPercents,
  columnsBlockMdGapX,
  columnsBlockMdItemsClass,
  normalizeColumnFlexForStorage,
  PROPOSAL_COLUMN_FR_MIN,
} from "@/lib/proposal-columns";
import {
  PROPOSAL_DOCUMENT_COLUMNS_ROW_GAP_CLASSES,
  PROPOSAL_PUBLIC_DOCUMENT_OUTER_CLASSES,
  PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES,
} from "@/lib/proposal-public-layout";
import { saveProposalDocumentAction, sendProposalAction } from "@/server/actions/proposal-builder";
import { saveProposalTemplateAction } from "@/server/actions/proposal-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { escapeHtml } from "@/lib/escape-html";
import { DEFAULT_HIGHLIGHT_COLOR, DEFAULT_PRIMARY_COLOR } from "@/lib/block-style";
import {
  DEFAULT_PACKAGES_UPFRONT_COST_12_MINOR,
  PACKAGE_TIER_UNLIMITED_VALUE,
} from "@/lib/package-tier-limits";
import { packagesAddonsSectionActive } from "@/lib/proposal-packages-totals";
import { resolveSectionBackground } from "@/lib/section-background";
import { defaultSplashBlock } from "@/lib/splash-block";
import {
  ProposalSplashBackgroundPicker,
  SplashBlockInspector,
} from "@/components/proposal/proposal-splash-editor";
import { AccordionBlockEditor } from "@/components/proposal/accordion-block-editor";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function headerRichHtmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function headerBlockEditorHtml(block: HeaderBlock): string {
  if (block.html?.trim()) return block.html;
  const t = (block.text ?? "").trim() || "Section heading";
  return `<h2>${escapeHtml(t)}</h2>`;
}

/**
 * Deep-clone a block while minting fresh ids for the block itself and any nested
 * collections (tiers, line items, form fields). Used by the toolbar's Duplicate action.
 */
function cloneBlockWithFreshIds(block: ProposalBlock): ProposalBlock {
  switch (block.type) {
    case "pricing":
      return {
        ...block,
        id: newId(),
        lineItems: (block.lineItems ?? []).map((li) => ({ ...li, id: newId() })),
      };
    case "packages":
      return {
        ...block,
        id: newId(),
        tiers: (block.tiers ?? []).map((t) => ({ ...t, id: newId(), features: [...(t.features ?? [])] })),
        addonLineItems: (block.addonLineItems ?? []).map((li) => ({ ...li, id: newId() })),
      };
    case "form":
      return {
        ...block,
        id: newId(),
        fields: (block.fields ?? []).map((f) => ({ ...f, id: newId(), options: f.options ? [...f.options] : undefined })),
      };
    case "accordion":
      return {
        ...block,
        id: newId(),
        panels: block.panels.map((p) => ({
          ...p,
          id: newId(),
        })),
      };
    case "columns": {
      const c = block as ColumnsBlock;
      return {
        ...c,
        id: newId(),
        stacks: c.stacks.map((stack) =>
          stack.map((child) => cloneBlockWithFreshIds(child as ProposalBlock) as ProposalColumnChildBlock),
        ),
      };
    }
    case "icon":
      return { ...block, id: newId() };
    case "splash":
      return { ...block, id: newId() };
    case "section":
      return {
        ...block,
        id: newId(),
        children: block.children.map((c) => cloneBlockWithFreshIds(c as ProposalBlock) as ProposalContentBlock),
      };
    default:
      return { ...block, id: newId() } as ProposalBlock;
  }
}

interface BlockOption {
  /** Stable key for React lists (multiple tiles may share `type`). */
  id: string;
  type: ProposalBlock["type"];
  label: string;
  icon: LucideIcon;
  /** Tailwind text color class for the tile icon. */
  accent: string;
  /** Tailwind background tint paired with the accent (used on the icon chip). */
  accentBg: string;
  /** Custom block payload (same `type` as the default blueprint). */
  factory?: () => ProposalBlock;
}

/** Primary tile grid in the insert popover (includes Quote line items). */
const PRIMARY_BLOCK_OPTIONS: BlockOption[] = [
  { id: "text", type: "text", label: "Text", icon: ScrollText, accent: "text-violet-500", accentBg: "bg-violet-500/10" },
  { id: "header", type: "header", label: "Heading", icon: Heading, accent: "text-sky-500", accentBg: "bg-sky-500/10" },
  { id: "splash", type: "splash", label: "Splash", icon: Mountain, accent: "text-teal-400", accentBg: "bg-teal-500/10" },
  { id: "pricing-quote", type: "pricing", label: "Quote", icon: Coins, accent: "text-emerald-500", accentBg: "bg-emerald-500/10" },
  { id: "packages", type: "packages", label: "Plans", icon: Package, accent: "text-amber-500", accentBg: "bg-amber-500/10" },
  { id: "video", type: "video", label: "Video", icon: MonitorPlay, accent: "text-rose-500", accentBg: "bg-rose-500/10" },
  { id: "signature", type: "signature", label: "Accept", icon: PenLine, accent: "text-cyan-500", accentBg: "bg-cyan-500/10" },
];

/** First tile when inserting at document root — groups nested blocks below. */
const SECTION_PRIMARY_OPTION: BlockOption = {
  id: "section",
  type: "section",
  label: "Section",
  icon: Layers,
  accent: "text-sky-500",
  accentBg: "bg-sky-500/10",
};

const DOCUMENT_PRIMARY_BLOCK_OPTIONS: BlockOption[] = [SECTION_PRIMARY_OPTION, ...PRIMARY_BLOCK_OPTIONS];

/** Insert menu surfaced inside grouped sections — focused layout pieces. */
const SECTION_INSERT_OPTIONS: BlockOption[] = [
  { id: "sx-text", type: "text", label: "Text", icon: ScrollText, accent: "text-violet-500", accentBg: "bg-violet-500/10" },
  { id: "sx-heading", type: "header", label: "Heading", icon: Heading, accent: "text-sky-500", accentBg: "bg-sky-500/10" },
  { id: "sx-splash", type: "splash", label: "Splash", icon: Mountain, accent: "text-teal-400", accentBg: "bg-teal-500/10" },
  { id: "sx-image", type: "image", label: "Image", icon: ImageIcon, accent: "text-fuchsia-500", accentBg: "bg-fuchsia-500/10" },
  {
    id: "sx-columns",
    type: "columns",
    label: "Columns",
    icon: LayoutGrid,
    accent: "text-cyan-500",
    accentBg: "bg-cyan-500/10",
  },
  {
    id: "sx-accordion",
    type: "accordion",
    label: "Accordion",
    icon: ListTree,
    accent: "text-amber-600",
    accentBg: "bg-amber-500/10",
  },
  { id: "sx-video", type: "video", label: "Video", icon: MonitorPlay, accent: "text-rose-500", accentBg: "bg-rose-500/10" },
  { id: "sx-icon", type: "icon", label: "Icon", icon: Star, accent: "text-yellow-500", accentBg: "bg-yellow-500/10" },
  {
    id: "sx-divider",
    type: "divider",
    label: "Divider",
    icon: SeparatorHorizontal,
    accent: "text-slate-400",
    accentBg: "bg-slate-500/10",
  },
  {
    id: "sx-spacer",
    type: "spacer",
    label: "Spacer",
    icon: MoveVertical,
    accent: "text-zinc-400",
    accentBg: "bg-zinc-500/10",
  },
];

/** Secondary options revealed via "Add block from library". */
const LIBRARY_BLOCK_OPTIONS: BlockOption[] = [
  { id: "image", type: "image", label: "Image", icon: ImageIcon, accent: "text-fuchsia-500", accentBg: "bg-fuchsia-500/10" },
  { id: "form", type: "form", label: "Form", icon: SquarePen, accent: "text-indigo-500", accentBg: "bg-indigo-500/10" },
  { id: "embed", type: "embed", label: "Embed", icon: LayoutTemplate, accent: "text-teal-500", accentBg: "bg-teal-500/10" },
  { id: "payment", type: "payment", label: "Payment", icon: CreditCard, accent: "text-orange-500", accentBg: "bg-orange-500/10" },
  { id: "divider", type: "divider", label: "Divider", icon: SeparatorHorizontal, accent: "text-slate-400", accentBg: "bg-slate-500/10" },
  { id: "spacer", type: "spacer", label: "Spacer", icon: MoveVertical, accent: "text-zinc-400", accentBg: "bg-zinc-500/10" },
];

function createColumnsBlock(count: ColumnLayoutCount): ColumnsBlock {
  return {
    id: newId(),
    type: "columns",
    stacks: Array.from({ length: count }, () => []),
  };
}

function createBlock(type: ProposalBlock["type"]): ProposalBlock {
  const id = newId();
  switch (type) {
    case "splash":
      return defaultSplashBlock(id);
    case "header":
      return {
        id,
        type: "header",
        text: "Section heading",
        html: "<h2>Section heading</h2>",
      };
    case "text":
      return { id, type: "text", html: "<p></p>" };
    case "image":
      return { id, type: "image", url: "https://", alt: "" };
    case "video":
      return { id, type: "video", url: "" };
    case "pricing":
      return {
        id,
        type: "pricing",
        currency: "aud",
        title: "Investment",
        allowQuantityEdit: true,
        lineItems: [{ id: newId(), label: "Service package", unitAmountMinor: 100_000, quantity: 1 }],
      };
    case "packages": {
      const t1 = newId();
      const t2 = newId();
      const t3 = newId();
      const t4 = newId();
      return {
        id,
        type: "packages",
        currency: "aud",
        title: "Packages",
        plan12Label: "12 months",
        plan24Label: "24 months",
        style: {
          variant: "visual",
          primaryColor: DEFAULT_PRIMARY_COLOR,
          highlightColor: DEFAULT_HIGHLIGHT_COLOR,
        },
        tiers: [
          {
            id: t1,
            name: "Starter",
            includedUsers: 3,
            includedLocations: 1,
            includedAdmins: 1,
            monthlyCost12Minor: 49_900,
            monthlyCost24Minor: 29_900,
            upfrontCost12Minor: DEFAULT_PACKAGES_UPFRONT_COST_12_MINOR,
            features: [],
          },
          {
            id: t2,
            name: "Professional",
            includedUsers: 5,
            includedLocations: 1,
            includedAdmins: 1,
            monthlyCost12Minor: 59_900,
            monthlyCost24Minor: 37_900,
            upfrontCost12Minor: DEFAULT_PACKAGES_UPFRONT_COST_12_MINOR,
            recommended: true,
            features: [],
          },
          {
            id: t3,
            name: "Premium",
            includedUsers: 10,
            includedLocations: 1,
            includedAdmins: 1,
            monthlyCost12Minor: 69_900,
            monthlyCost24Minor: 49_900,
            upfrontCost12Minor: DEFAULT_PACKAGES_UPFRONT_COST_12_MINOR,
            features: [],
          },
          {
            id: t4,
            name: "Enterprise",
            includedUsers: PACKAGE_TIER_UNLIMITED_VALUE,
            includedLocations: PACKAGE_TIER_UNLIMITED_VALUE,
            includedAdmins: PACKAGE_TIER_UNLIMITED_VALUE,
            monthlyCost12Minor: 149_900,
            monthlyCost24Minor: 99_900,
            upfrontCost12Minor: DEFAULT_PACKAGES_UPFRONT_COST_12_MINOR,
            features: [],
          },
        ],
        addonsSectionEnabled: false,
      };
    }
    case "form":
      return {
        id,
        type: "form",
        submitLabel: "Your details",
        fields: [{ id: newId(), label: "Anything we should know?", fieldType: "textarea", required: false }],
      };
    case "signature":
      return {
        id,
        type: "signature",
        title: "Agreement",
        signerLabel: "Authorized signatory",
        requirePrintedName: true,
        requireAcceptTerms: true,
        termsSummary: "By accepting, you agree to the scope and pricing described above.",
      };
    case "embed":
      return { id, type: "embed", url: "", title: "Embedded content" };
    case "payment":
      return { id, type: "payment", label: "Secure payment" };
    case "divider":
      return { id, type: "divider" };
    case "spacer":
      return { id, type: "spacer", heightPx: 40 };
    case "accordion":
      return {
        id,
        type: "accordion",
        panels: [{ id: newId(), title: "Question", html: "<p></p>" }],
      };
    case "columns":
      return createColumnsBlock(2);
    case "icon":
      return { id, type: "icon", emoji: "✨", label: "" };
    case "section":
      return {
        id,
        type: "section",
        children: [],
        style: {
          variant: "simple",
          primaryColor: DEFAULT_PRIMARY_COLOR,
          highlightColor: DEFAULT_HIGHLIGHT_COLOR,
        },
      };
    default:
      return { id, type: "text", html: "<p></p>" };
  }
}

/**
 * Seamless sortable row: hover or selection shows a unified pill toolbar; drag handle mounts inside the toolbar.
 */
function SortableShell({
  id,
  children,
  selected,
  onSelect,
  toolbar,
}: {
  id: string;
  children: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  toolbar?: (ctx: {
    dragAttributes: DraggableAttributes;
    dragListeners: DraggableSyntheticListeners;
  }) => React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const sectionChrome = useProposalSectionEditorChrome();
  const seamless = sectionChrome?.seamless ?? false;
  const prefersLightSection = sectionChrome?.prefersLight ?? false;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const showToolbar = Boolean(toolbar && (selected || hovered));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("group/sortblock relative scroll-mt-28", isDragging && "opacity-55")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showToolbar && toolbar ? (
        <div className="pointer-events-none absolute left-0 top-0 z-30 -translate-y-full pb-1.5 pt-2 sm:left-2">
          <div className="pointer-events-auto">
            {toolbar({ dragAttributes: attributes, dragListeners: listeners })}
          </div>
        </div>
      ) : null}
      <div
        role="presentation"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={cn(
          "relative px-0 py-1.5 [-webkit-tap-highlight-color:transparent]",
          seamless
            ? cn(
                "transition-none",
                selected
                  ? prefersLightSection
                    ? "rounded-[2px] ring-1 ring-white/40 ring-offset-0"
                    : "rounded-[2px] ring-1 ring-primary/50 ring-offset-0"
                  : "rounded-[2px]",
                // Flush with section backdrop — no hover/focus tint behind nested editors or inputs.
                "!bg-transparent hover:!bg-transparent focus-within:!bg-transparent active:!bg-transparent",
                "dark:!bg-transparent dark:hover:!bg-transparent dark:focus-within:!bg-transparent dark:active:!bg-transparent",
              )
            : cn(
                "transition-colors",
                selected
                  ? "rounded-[2px] ring-1 ring-primary/45 ring-offset-2 ring-offset-transparent"
                  : "rounded-[2px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
              ),
        )}
      >
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function DarkInsertRow({
  icon: Icon,
  label,
  onPick,
}: {
  icon: LucideIcon;
  label: string;
  onPick: () => void;
}) {
  return (
    <DropdownMenuItem
      className="cursor-pointer gap-2 rounded-none px-2.5 py-1.5 text-[13px] text-zinc-100 focus:bg-white/10 focus:text-white"
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        onPick();
      }}
      onSelect={(e: Event) => e.preventDefault()}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-white/[0.06] ring-1 ring-white/10">
        <Icon className="h-3 w-3 text-zinc-100" aria-hidden />
      </span>
      {label}
    </DropdownMenuItem>
  );
}

function SectionInsertMenu({
  onAdd,
  trigger,
  align = "start",
}: {
  onAdd: (block: ProposalBlock) => void;
  trigger: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = React.useState(false);

  function pick(option: BlockOption) {
    onAdd(option.factory?.() ?? createBlock(option.type));
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={4}
        className={cn(
          "w-[min(200px,calc(100vw-2rem))] overflow-hidden rounded-lg border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-xl",
        )}
        onCloseAutoFocus={(event: Event) => event.preventDefault()}
      >
        <p className="px-2.5 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Content
        </p>
        <div className="pb-1">
          {SECTION_INSERT_OPTIONS.map((opt) => (
            <DarkInsertRow key={opt.id} icon={opt.icon} label={opt.label} onPick={() => pick(opt)} />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function patchColumnStackAtIndex(
  cols: ColumnsBlock,
  columnIndex: number,
  stack: ProposalColumnChildBlock[],
): ColumnsBlock {
  return {
    ...cols,
    stacks: cols.stacks.map((s, i) => (i === columnIndex ? stack : s)),
  };
}

function ColumnResizeGrip({
  gripped,
  onPointerDown,
}: {
  gripped: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="relative z-10 hidden w-3 shrink-0 cursor-col-resize select-none touch-none md:block"
      onPointerDown={onPointerDown}
    >
      <div className="flex h-full min-h-[100px] w-full cursor-col-resize items-center justify-center">
        <div
          className={cn(
            "min-h-[3rem] w-1 rounded-full transition-colors",
            gripped ? "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.45)]" : "bg-sky-500/85",
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}

function NestedColumnBlockFields({
  block,
  onChange,
}: {
  block: ProposalColumnChildBlock;
  onChange: (next: ProposalColumnChildBlock) => void;
}) {
  const patchNested = (next: ProposalBlock) => onChange(next as ProposalColumnChildBlock);
  switch (block.type) {
    case "header": {
      const hb = block as HeaderBlock;
      return (
        <ProposalRichText
          key={hb.id}
          variant="header"
          html={headerBlockEditorHtml(hb)}
          placeholder="Heading"
          onChange={(html) =>
            patchNested({
              ...hb,
              html,
              text: headerRichHtmlToPlainText(html) || hb.text,
            })
          }
        />
      );
    }
    case "text":
      return (
        <ProposalRichText
          html={block.html ?? (block.body ? `<p>${escapeHtml(block.body)}</p>` : "<p></p>")}
          editorMinHeightPx={block.editorMinHeightPx}
          onEditorMinHeightPxChange={(next) => patchNested({ ...block, editorMinHeightPx: next })}
          resizableHeight
          onChange={(html) => patchNested({ ...block, html, body: undefined })}
        />
      );
    case "divider":
      return <p className="text-[11px] text-muted-foreground">Divider — visible when published.</p>;
    default:
      return (
        <BlockFields
          block={block as ProposalBlock}
          onChange={patchNested}
        />
      );
  }
}

function ColumnsBlockFields({
  block,
  onChange,
  resizeLayoutActive,
  onExitResizeLayout,
}: {
  block: ColumnsBlock;
  onChange: (next: ColumnsBlock) => void;
  resizeLayoutActive?: boolean;
  onExitResizeLayout?: () => void;
}) {
  const columnCount = block.stacks.length as ColumnLayoutCount;
  const allColumnsEmpty = block.stacks.every((s) => s.length === 0);
  const resizeMode = Boolean(resizeLayoutActive);
  const columnWidthRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const blockRef = React.useRef(block);
  blockRef.current = block;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const [dragDividerIndex, setDragDividerIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!resizeMode) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExitResizeLayout?.();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [resizeMode, onExitResizeLayout]);

  React.useEffect(() => {
    if (dragDividerIndex === null) return;
    const di = dragDividerIndex;

    function applyFromClientX(clientX: number) {
      const elL = columnWidthRefs.current[di];
      const elR = columnWidthRefs.current[di + 1];
      if (!elL || !elR) return;
      const rl = elL.getBoundingClientRect();
      const rr = elR.getBoundingClientRect();
      const span = rr.right - rl.left;
      if (span < 40) return;
      let t = (clientX - rl.left) / span;
      t = Math.min(0.93, Math.max(0.07, t));
      const b = blockRef.current;
      const weights = coerceColumnFlex(b.stacks.length, b.columnFlex);
      const pair = weights[di] + weights[di + 1];
      const newLeftUnclamped = t * pair;
      const newLeft = Math.min(pair - PROPOSAL_COLUMN_FR_MIN, Math.max(PROPOSAL_COLUMN_FR_MIN, newLeftUnclamped));
      const newRight = pair - newLeft;
      const next = [...weights];
      next[di] = clampFr(newLeft);
      next[di + 1] = clampFr(newRight);
      onChangeRef.current({
        ...b,
        columnFlex: normalizeColumnFlexForStorage(next.length, next),
      });
    }

    function onMove(e: PointerEvent) {
      applyFromClientX(e.clientX);
    }
    function onUp(e: PointerEvent) {
      applyFromClientX(e.clientX);
      setDragDividerIndex(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragDividerIndex]);

  function ColumnPane({
    label,
    columnIndex,
    stack,
  }: {
    label: string;
    columnIndex: number;
    stack: ProposalColumnChildBlock[];
  }) {
    function setStack(next: ProposalColumnChildBlock[]) {
      onChange(patchColumnStackAtIndex(block, columnIndex, next));
    }
    function addToEnd(insert: ProposalBlock) {
      const n = [...stack];
      n.push(insert as ProposalColumnChildBlock);
      setStack(n);
    }
    function removeAt(id: string) {
      setStack(stack.filter((x) => x.id !== id));
    }
    function move(id: string, dir: -1 | 1) {
      const i = stack.findIndex((x) => x.id === id);
      if (i < 0) return;
      const t = i + dir;
      if (t < 0 || t >= stack.length) return;
      setStack(arrayMove(stack, i, t));
    }
    function dup(id: string) {
      const i = stack.findIndex((x) => x.id === id);
      if (i < 0) return;
      const cloned = cloneBlockWithFreshIds(stack[i] as ProposalBlock) as ProposalColumnChildBlock;
      const n = [...stack];
      n.splice(i + 1, 0, cloned);
      setStack(n);
    }
    function updateChild(childId: string, nextChild: ProposalColumnChildBlock) {
      setStack(stack.map((c) => (c.id === childId ? nextChild : c)));
    }
    return (
      <div className="min-w-0 space-y-4">
        <span className="sr-only">{label}</span>
        <div className="flex justify-end">
          <SectionInsertMenu
            align="end"
            onAdd={addToEnd}
            trigger={
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            }
          />
        </div>
        {stack.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/50 px-3 py-8 text-center text-xs text-muted-foreground">
            Empty column — use Add above or drop from the library.
          </p>
        ) : (
          stack.map((child, idx) => (
            <div key={child.id} className="group/colitem space-y-2 pb-8 border-b border-border/25 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover/colitem:opacity-100 md:group-focus-within/colitem:opacity-100">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={idx === 0} onClick={() => move(child.id, -1)}>
                  Up
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={idx === stack.length - 1} onClick={() => move(child.id, 1)}>
                  Down
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => dup(child.id)}>
                  Duplicate
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => removeAt(child.id)}>
                  Remove
                </Button>
              </div>
              <NestedColumnBlockFields block={child} onChange={(n) => updateChild(child.id, n)} />
            </div>
          ))
        )}
      </div>
    );
  }

  const flexRow = coerceColumnFlex(columnCount, block.columnFlex);
  const flexPercents = resizeMode ? columnFlexPercents(flexRow) : [];

  return (
    <div className="space-y-8">
      {allColumnsEmpty ? (
        <p className="rounded-md border border-dashed border-border/55 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
          Use <strong className="font-medium text-foreground">Edit columns</strong> in the toolbar to choose how many columns you need, then add blocks in each column.
        </p>
      ) : null}

      {resizeMode ? (
        <div className="space-y-1.5">
          <p className="text-center text-[12px] font-medium text-sky-600 dark:text-sky-300 md:text-left">
            Drag the blue lines to adjust width — Done when finished.
          </p>
          <p className="text-center text-sm font-semibold tracking-tight tabular-nums text-sky-950 dark:text-sky-50 md:text-left">
            {flexPercents.map((p) => `${p}%`).join(" · ")}
          </p>
        </div>
      ) : null}

      {(() => {
        const pad =
          typeof block.insetPaddingPx === "number" && Number.isFinite(block.insetPaddingPx)
            ? Math.min(64, Math.max(0, Math.round(block.insetPaddingPx)))
            : 0;
        const gapClasses = columnsBlockMdGapX(block.columnGap, columnCount);
        const gapClassesEffective = resizeMode ? "md:gap-x-0" : gapClasses;
        const itemsClasses = columnsBlockMdItemsClass(block.rowAlign);
        const columnRow = (
          <div
            className={cn(
              "flex flex-col gap-6 md:flex-row",
              PROPOSAL_DOCUMENT_COLUMNS_ROW_GAP_CLASSES,
              gapClassesEffective,
              itemsClasses,
              resizeMode &&
                "rounded-xl border-2 border-dashed border-sky-500/55 bg-sky-500/[0.03] py-1 dark:border-sky-400/50 dark:bg-sky-950/15",
            )}
          >
            {block.stacks.map((stack, i) => (
              <React.Fragment key={`${block.id}-col-${i}`}>
                <div
                  ref={(el) => {
                    columnWidthRefs.current[i] = el;
                  }}
                  className={cn(
                    "min-w-0 md:min-w-[3.5rem]",
                    resizeMode &&
                      "rounded-lg border border-sky-400/40 bg-background/60 py-1 ring-1 ring-sky-500/20 dark:bg-background/40 md:px-0 md:py-1",
                  )}
                  style={{ flex: `${flexRow[i]} 1 0%` } as React.CSSProperties}
                >
                  <ColumnPane label={`Column ${i + 1}`} columnIndex={i} stack={stack} />
                </div>
                {resizeMode && i < block.stacks.length - 1 ? (
                  <ColumnResizeGrip
                    gripped={dragDividerIndex === i}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragDividerIndex(i);
                    }}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        );
        if (pad <= 0) return columnRow;
        return (
          <div className="rounded-lg" style={{ padding: pad }}>
            {columnRow}
          </div>
        );
      })()}
    </div>
  );
}

function SectionBlockFields({
  block,
  onChange,
  selectedBlockId,
  onSelectBlock,
  getBlockStyle,
  applyBlockStyle,
}: {
  block: SectionBlock;
  onChange: (next: ProposalBlock) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  getBlockStyle: (b: ProposalBlock) => BlockStyle | undefined;
  applyBlockStyle: (id: string, style: BlockStyle | undefined) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const children = block.children;
  const [columnsLayoutEditingId, setColumnsLayoutEditingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (columnsLayoutEditingId && !children.some((c) => c.id === columnsLayoutEditingId)) {
      setColumnsLayoutEditingId(null);
    }
  }, [children, columnsLayoutEditingId]);

  function setChildren(nextChildren: ProposalContentBlock[]) {
    onChange({ ...block, children: nextChildren });
  }

  function updateChild(childId: string, next: ProposalContentBlock) {
    setChildren(children.map((c) => (c.id === childId ? next : c)));
  }

  function removeChild(childId: string) {
    setChildren(children.filter((c) => c.id !== childId));
    if (selectedBlockId === childId) onSelectBlock(null);
    if (columnsLayoutEditingId === childId) setColumnsLayoutEditingId(null);
  }

  function addChildAt(b: ProposalBlock, index: number) {
    const c = b as ProposalContentBlock;
    const next = [...children];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, c);
    setChildren(next);
  }

  function moveChild(childId: string, direction: -1 | 1) {
    const idx = children.findIndex((c) => c.id === childId);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= children.length) return;
    setChildren(arrayMove(children, idx, target));
  }

  function duplicateChild(childId: string) {
    const idx = children.findIndex((c) => c.id === childId);
    if (idx < 0) return;
    const cloned = cloneBlockWithFreshIds(children[idx] as ProposalBlock) as ProposalContentBlock;
    const next = [...children];
    next.splice(idx + 1, 0, cloned);
    setChildren(next);
    onSelectBlock(null);
  }

  function onChildDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = children.findIndex((c) => c.id === active.id);
    const newIndex = children.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setChildren(arrayMove(children, oldIndex, newIndex));
  }

  const resolvedBg = resolveSectionBackground(block.background);
  const backdropOn = resolvedBg.active;

  const sectionStack =
    children.length === 0 ? (
      <div className="flex flex-col items-center gap-5 py-14 text-center">
        <div className="max-w-[20rem] space-y-1">
          <p className="text-sm font-medium text-foreground">Group related content</p>
          <p className="text-xs text-muted-foreground">
            Stack headings, prose, visuals, layouts, accordion panels, and more — then reorder with the contextual
            controls.
          </p>
        </div>
        <SectionInsertMenu
          align="center"
          onAdd={(b) => addChildAt(b, 0)}
          trigger={
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-lg",
                "bg-gradient-to-b from-zinc-800 to-black ring-2 ring-black/85 transition-colors hover:to-zinc-900",
              )}
            >
              <Plus className="h-4 w-4" /> Content
            </button>
          }
        />
      </div>
    ) : (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onChildDragEnd}>
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <InsertBlockSlot context="section" variant="between" onAdd={(b) => addChildAt(b, 0)} />
          {children.map((child, idx) => {
            const isSelected = selectedBlockId === child.id;
            const supportsStyle = child.type === "packages";
            return (
              <div key={child.id}>
                <SortableShell
                  id={child.id}
                  selected={isSelected}
                  onSelect={() => {
                    setColumnsLayoutEditingId((prev) =>
                      prev !== null && prev !== child.id ? null : prev,
                    );
                    onSelectBlock(child.id);
                  }}
                  toolbar={({ dragAttributes, dragListeners }) => {
                    const dragHandle = (
                      <Tooltip delayDuration={320}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="touch-none inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                            aria-label={`Reorder ${blockLabel(child.type)}`}
                            {...dragAttributes}
                            {...dragListeners}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          Drag to move · arrows nudge precisely
                        </TooltipContent>
                      </Tooltip>
                    );
                    const compactColumnsChrome = child.type === "columns";
                    return (
                      <BlockToolbar
                        appearance="surface"
                        blockType={
                          child.type === "pricing"
                            ? "pricing"
                            : child.type === "packages"
                              ? "packages"
                              : "other"
                        }
                        canMoveUp={idx > 0}
                        canMoveDown={idx < children.length - 1}
                        onMoveUp={() => moveChild(child.id, -1)}
                        onMoveDown={() => moveChild(child.id, 1)}
                        onDuplicate={() => duplicateChild(child.id)}
                        deleteLabel="Remove block"
                        onDelete={() => removeChild(child.id)}
                        compactChrome={compactColumnsChrome}
                        compactPrimarySlot={
                          compactColumnsChrome ? (
                            columnsLayoutEditingId === child.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setColumnsLayoutEditingId(null);
                                  }}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-500/15 dark:text-teal-400 dark:hover:bg-teal-500/10"
                                >
                                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                                  Done
                                </button>
                                <ColumnsBlockLayoutControls
                                  block={children.find((c) => c.id === child.id) as ColumnsBlock}
                                  onPatch={(patch) => {
                                    const cur = children.find((c) => c.id === child.id);
                                    if (!cur || cur.type !== "columns") return;
                                    updateChild(child.id, { ...cur, ...patch } as ProposalContentBlock);
                                  }}
                                />
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setColumnsLayoutEditingId(child.id);
                                }}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                              >
                                <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                                Edit columns
                              </button>
                            )
                          ) : undefined
                        }
                        // Inner blocks now mirror the section toolbar: drag handle leads,
                        // overflow "more" menu is suppressed (Duplicate/Delete already
                        // sit inline). The packages add-ons removal action is the only
                        // overflow-only lever, so it's promoted into the visible row
                        // via `auxiliarySlot` when applicable.
                        showOverflowMenu={false}
                        auxiliarySlot={
                          child.type === "packages" &&
                          packagesAddonsSectionActive(child as PackagesBlock) ? (
                            <Tooltip delayDuration={320}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                                  onClick={() => {
                                    const p = child as PackagesBlock;
                                    updateChild(child.id, {
                                      ...p,
                                      addonsSectionEnabled: false,
                                    } as ProposalContentBlock);
                                  }}
                                  aria-label="Remove add-ons table"
                                >
                                  Remove add-ons
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs">
                                Remove the add-ons sub-table from this Packages block
                              </TooltipContent>
                            </Tooltip>
                          ) : undefined
                        }
                        style={supportsStyle ? getBlockStyle(child) : undefined}
                        onStyleChange={
                          supportsStyle ? (next) => applyBlockStyle(child.id, next) : undefined
                        }
                        backdropPickerSlot={
                          child.type === "splash" ? (
                            <ProposalSplashBackgroundPicker
                              block={child as SplashBlock}
                              onChange={(next) =>
                                updateChild(child.id, next as ProposalContentBlock)
                              }
                            />
                          ) : undefined
                        }
                        leadingSlot={dragHandle}
                      />
                    );
                  }}
                >
                  <BlockFields
                    block={child}
                    onChange={(next) => updateChild(child.id, next as ProposalContentBlock)}
                    selection={{
                      selectedId: selectedBlockId,
                      onSelect: onSelectBlock,
                    }}
                    getBlockStyle={getBlockStyle}
                    applyBlockStyle={applyBlockStyle}
                    columnsLayoutEditing={{
                      activeId: columnsLayoutEditingId,
                      setActiveId: setColumnsLayoutEditingId,
                    }}
                  />
                </SortableShell>
                <InsertBlockSlot context="section" variant="between" onAdd={(b) => addChildAt(b, idx + 1)} />
              </div>
            );
          })}
        </SortableContext>
      </DndContext>
    );

  return (
    <ProposalSectionShell background={block.background} variant="editor">
      {backdropOn ? (
        sectionStack
      ) : (
        <div className="rounded-xl border border-dashed border-border/65 bg-muted/15 px-1 py-1 sm:bg-muted/[0.35]">
          {sectionStack}
        </div>
      )}
    </ProposalSectionShell>
  );
}

const SPACER_HEIGHT_MIN_PX = 1;
const SPACER_HEIGHT_MAX_PX = 2400;

function clampSpacerHeightPx(n: number): number {
  return Math.min(SPACER_HEIGHT_MAX_PX, Math.max(SPACER_HEIGHT_MIN_PX, Math.round(n)));
}

function SpacerBlockHeightEditor({
  block,
  onChange,
}: {
  block: SpacerBlock;
  onChange: (next: SpacerBlock) => void;
}) {
  const h =
    typeof block.heightPx === "number" && Number.isFinite(block.heightPx)
      ? clampSpacerHeightPx(block.heightPx)
      : 40;
  const dragRef = React.useRef<{ startY: number; startH: number } | null>(null);

  function applyHeight(next: number) {
    onChange({ ...block, heightPx: clampSpacerHeightPx(next) });
  }

  const gripPx = Math.min(28, Math.max(6, Math.round(h * 0.28)));
  const labelHeight = Math.max(0, h - gripPx);

  return (
    <div className="w-full space-y-2">
      <label htmlFor={`spacer-h-a11y-${block.id}`} className="sr-only">
        Spacer height in pixels (1–2400)
      </label>
      <input
        id={`spacer-h-a11y-${block.id}`}
        type="number"
        min={SPACER_HEIGHT_MIN_PX}
        max={SPACER_HEIGHT_MAX_PX}
        value={h}
        onChange={(e) => {
          const raw = e.target.value;
          const n = raw === "" ? NaN : Number(raw);
          if (!Number.isFinite(n)) return;
          applyHeight(n);
        }}
        className="sr-only"
      />

      <div
        className="relative w-full overflow-hidden rounded-md border border-dashed border-primary/30 bg-muted/25 dark:border-primary/40 dark:bg-muted/15"
        style={{ height: h }}
        role="group"
        aria-label={`Spacer, ${h} pixels tall`}
      >
        {labelHeight > 0 ? (
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-center px-2"
            style={{ height: labelHeight }}
          >
            <span
              className={cn(
                "font-semibold tabular-nums tracking-tight text-muted-foreground",
                labelHeight < 22 ? "text-[10px] leading-none" : "text-sm",
              )}
            >
              {h}px
            </span>
          </div>
        ) : (
          <span className="sr-only">{h} pixels</span>
        )}

        <button
          type="button"
          style={{ height: gripPx }}
          className="absolute bottom-0 left-0 right-0 z-[2] flex cursor-ns-resize touch-none items-center justify-center gap-0.5 border-0 bg-muted/40 p-0 text-primary outline-none backdrop-blur-[2px] transition-colors hover:bg-primary/15 focus-visible:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-muted/30"
          aria-label="Drag to resize spacer height"
          title="Drag up or down to change height"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            dragRef.current = { startY: e.clientY, startH: h };
            (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d) return;
            applyHeight(d.startH + (e.clientY - d.startY));
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
        >
          <ChevronUp className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          <div className="flex h-3 w-10 items-center justify-center" aria-hidden>
            <Minus className="h-3 w-8 text-primary opacity-80" strokeWidth={2.5} />
          </div>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Drag the bottom edge to set height. Readers only see vertical space — no line or label.
      </p>
    </div>
  );
}

function BlockFields({
  block,
  onChange,
  selection,
  getBlockStyle,
  applyBlockStyle,
  columnsLayoutEditing,
}: {
  block: ProposalBlock;
  onChange: (next: ProposalBlock) => void;
  selection?: { selectedId: string | null; onSelect: (id: string | null) => void };
  getBlockStyle?: (b: ProposalBlock) => BlockStyle | undefined;
  applyBlockStyle?: (id: string, style: BlockStyle | undefined) => void;
  columnsLayoutEditing?: {
    activeId: string | null;
    setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  };
}) {
  const patch = (next: ProposalBlock) => onChange(next);
  const sectionChrome = useProposalSectionEditorChrome();
  const seamlessSection = sectionChrome?.seamless ?? false;

  switch (block.type) {
    case "splash": {
      const b = block as SplashBlock;
      return <SplashBlockInspector block={b} onChange={(next) => patch(next)} />;
    }
    case "section": {
      const b = block as SectionBlock;
      return (
        <SectionBlockFields
          block={b}
          onChange={patch}
          selectedBlockId={selection?.selectedId ?? null}
          onSelectBlock={selection?.onSelect ?? (() => {})}
          getBlockStyle={getBlockStyle ?? (() => undefined)}
          applyBlockStyle={applyBlockStyle ?? (() => {})}
        />
      );
    }
    case "header": {
      const b = block as HeaderBlock;
      return (
        <div className="space-y-3">
          <ProposalRichText
            key={b.id}
            variant="header"
            html={headerBlockEditorHtml(b)}
            placeholder="Heading"
            onChange={(html) =>
              patch({
                ...b,
                html,
                text: headerRichHtmlToPlainText(html) || b.text,
              })
            }
          />
        </div>
      );
    }
    case "text": {
      const b = block as TextBlock;
      return (
        <div className="space-y-3">
          <ProposalRichText
            key={b.id}
            html={b.html ?? (b.body ? `<p>${escapeHtml(b.body)}</p>` : "<p></p>")}
            editorMinHeightPx={b.editorMinHeightPx}
            onEditorMinHeightPxChange={(next) => patch({ ...b, editorMinHeightPx: next })}
            resizableHeight
            onChange={(html) => patch({ ...b, html, body: undefined })}
          />
        </div>
      );
    }
    case "image": {
      const b = block as ImageBlock;
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Image URL</Label>
            <Input value={b.url} onChange={(e) => patch({ ...b, url: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Alt text</Label>
            <Input value={b.alt ?? ""} onChange={(e) => patch({ ...b, alt: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Caption</Label>
            <Input value={b.caption ?? ""} onChange={(e) => patch({ ...b, caption: e.target.value })} />
          </div>
        </div>
      );
    }
    case "video": {
      const b = block as VideoBlock;
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Video URL (YouTube or Vimeo)</Label>
            <Input value={b.url} onChange={(e) => patch({ ...b, url: e.target.value })} placeholder="https://…" />
          </div>
        </div>
      );
    }
    case "pricing": {
      const b = block as PricingBlock;
      return <PricingInlineEditor block={b} onChange={patch} />;
    }
    case "packages": {
      const b = block as PackagesBlock;
      return (
        <div className={cn(!seamlessSection && PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES)}>
          <PackagesInlineEditor block={b} onChange={patch} />
        </div>
      );
    }
    case "form": {
      const b = block as FormBlock;
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Submit label</Label>
            <Input value={b.submitLabel ?? ""} onChange={(e) => patch({ ...b, submitLabel: e.target.value })} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() =>
              patch({
                ...b,
                fields: [
                  ...b.fields,
                  { id: newId(), label: "New field", fieldType: "text", required: false },
                ],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add field
          </Button>
          {b.fields.map((f, idx) => (
            <div key={f.id} className="grid gap-2 rounded-lg border border-border/50 p-3 sm:grid-cols-2">
              <Input
                value={f.label}
                onChange={(e) => {
                  const fields = [...b.fields];
                  fields[idx] = { ...f, label: e.target.value };
                  patch({ ...b, fields });
                }}
              />
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={f.fieldType}
                onChange={(e) => {
                  const fields = [...b.fields] as FormField[];
                  fields[idx] = { ...f, fieldType: e.target.value as FormField["fieldType"] };
                  patch({ ...b, fields });
                }}
              >
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="textarea">Paragraph</option>
                <option value="select">Select</option>
              </select>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(f.required)}
                  onChange={(e) => {
                    const fields = [...b.fields];
                    fields[idx] = { ...f, required: e.target.checked };
                    patch({ ...b, fields });
                  }}
                />
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive sm:col-span-2"
                onClick={() => patch({ ...b, fields: b.fields.filter((x) => x.id !== f.id) })}
              >
                Remove field
              </Button>
            </div>
          ))}
        </div>
      );
    }
    case "signature": {
      const b = block as SignatureBlock;
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={b.title ?? ""} onChange={(e) => patch({ ...b, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Signatory label</Label>
            <Input value={b.signerLabel ?? ""} onChange={(e) => patch({ ...b, signerLabel: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Terms summary</Label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={b.termsSummary ?? ""}
              onChange={(e) => patch({ ...b, termsSummary: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(b.requirePrintedName)}
              onChange={(e) => patch({ ...b, requirePrintedName: e.target.checked })}
            />
            Require printed name on acceptance
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(b.requireAcceptTerms)}
              onChange={(e) => patch({ ...b, requireAcceptTerms: e.target.checked })}
            />
            Require terms acknowledgment
          </label>
        </div>
      );
    }
    case "embed":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Embed URL</Label>
            <Input value={block.url} onChange={(e) => patch({ ...block, url: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={block.title ?? ""} onChange={(e) => patch({ ...block, title: e.target.value })} />
          </div>
        </div>
      );
    case "payment":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={block.label ?? ""} onChange={(e) => patch({ ...block, label: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Stripe price ID (optional)</Label>
            <Input
              value={block.stripePriceId ?? ""}
              onChange={(e) => patch({ ...block, stripePriceId: e.target.value || undefined })}
              placeholder="price_…"
            />
          </div>
        </div>
      );
    case "columns": {
      const col = block as ColumnsBlock;
      return (
        <ColumnsBlockFields
          block={col}
          onChange={(next) => patch(next)}
          resizeLayoutActive={columnsLayoutEditing?.activeId === col.id}
          onExitResizeLayout={() => columnsLayoutEditing?.setActiveId(null)}
        />
      );
    }
    case "accordion":
      return <AccordionBlockEditor block={block as AccordionBlock} onChange={(next) => patch(next)} />;
    case "icon": {
      const ic = block as IconBlock;
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Emoji or symbol</Label>
            <Input
              value={ic.emoji ?? ""}
              maxLength={8}
              onChange={(e) => patch({ ...ic, emoji: e.target.value || undefined })}
              placeholder="e.g. ✨"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Caption</Label>
            <Input value={ic.label ?? ""} onChange={(e) => patch({ ...ic, label: e.target.value })} placeholder="Displayed beside icon" />
          </div>
        </div>
      );
    }
    case "divider":
      return <p className="text-sm text-muted-foreground">Horizontal rule — visible on the public page.</p>;
    case "spacer": {
      const sb = block as SpacerBlock;
      return <SpacerBlockHeightEditor block={sb} onChange={(next) => patch(next)} />;
    }
    default:
      return null;
  }
}

/**
 * Insert popover triggered by the round "+" button between blocks.
 * Shows a 3×2 grid of primary block tiles and reveals a secondary library list
 * via "Add block from library".
 */
function AddBlockMenu({
  onAdd,
  trigger,
  align = "center",
}: {
  onAdd: (block: ProposalBlock) => void;
  trigger: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"main" | "library">("main");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      window.setTimeout(() => setView("main"), 150);
    }
  }

  function handlePick(option: BlockOption) {
    onAdd(option.factory?.() ?? createBlock(option.type));
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className="w-[320px] p-0"
        onCloseAutoFocus={(event: Event) => event.preventDefault()}
      >
        {view === "main" ? (
          <div className="p-3">
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Add a block
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DOCUMENT_PRIMARY_BLOCK_OPTIONS.map((opt) => (
                <BlockTile key={opt.id} option={opt} onSelect={() => handlePick(opt)} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setView("library")}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border-t border-border/60 px-2 py-2 pt-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Add block from library
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="p-2">
            <button
              type="button"
              onClick={() => setView("main")}
              className="mb-1 flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Content
            </p>
            <div className="space-y-0.5">
              {LIBRARY_BLOCK_OPTIONS.map((opt) => (
                <LibraryRow key={opt.id} option={opt} onSelect={() => handlePick(opt)} />
              ))}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BlockTile({ option, onSelect }: { option: BlockOption; onSelect: () => void }) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col items-center justify-center gap-1.5 rounded-lg border border-transparent bg-muted/40 px-2 py-3 text-xs font-medium text-foreground transition-all hover:border-border hover:bg-accent hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition-transform group-hover:scale-105",
          option.accentBg,
        )}
      >
        <Icon className={cn("h-4 w-4", option.accent)} />
      </span>
      <span className="text-[11px] uppercase tracking-wide">{option.label}</span>
    </button>
  );
}

function LibraryRow({ option, onSelect }: { option: BlockOption; onSelect: () => void }) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:bg-accent"
    >
      <span className={cn("flex h-6 w-6 items-center justify-center rounded", option.accentBg)}>
        <Icon className={cn("h-3.5 w-3.5", option.accent)} />
      </span>
      {option.label}
    </button>
  );
}

/**
 * Hairline + circular "+" affordance rendered between (and around) blocks.
 * Hovering the slot highlights the line and reveals the trigger; clicking
 * opens the AddBlockMenu, which inserts at this exact position.
 */
function InsertBlockSlot({
  onAdd,
  variant = "between",
  context = "document",
}: {
  onAdd: (block: ProposalBlock) => void;
  variant?: "between" | "empty";
  /** `section` swaps the picker to the condensed gallery optimised for grouped layouts. */
  context?: "document" | "section";
}) {
  if (variant === "empty") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">Start building your proposal</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Add a grouped layout, text blocks, headings, visuals, quoting tables, accepting signatures, plus everything in your
          block library — then refine with the contextual toolbar.
        </p>
        <AddBlockMenu
          onAdd={onAdd}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/60 hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Add a block"
            >
              <Plus className="h-4 w-4" /> Add block
            </button>
          }
        />
      </div>
    );
  }
  const sharedTriggerClasses =
    "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground opacity-0 shadow-sm transition-opacity hover:border-primary hover:bg-primary hover:text-primary-foreground hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary data-[state=open]:bg-primary data-[state=open]:text-primary-foreground data-[state=open]:opacity-100 group-hover/insert:opacity-100 bg-background";

  const trigger = (
    <button type="button" aria-label={context === "section" ? "Insert content row" : "Add block here"} className={sharedTriggerClasses}>
      <Plus className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className="group/insert relative flex items-center justify-center py-1.5">
      <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-primary/40 opacity-0 transition-opacity group-hover/insert:opacity-70 group-focus-within/insert:opacity-70" />
      {context === "section" ? (
        <SectionInsertMenu align="center" onAdd={onAdd} trigger={trigger} />
      ) : (
        <AddBlockMenu onAdd={onAdd} trigger={trigger} />
      )}
    </div>
  );
}

function blockLabel(type: ProposalBlock["type"]): string {
  switch (type) {
    case "header":
      return "Heading";
    case "splash":
      return "Splash";
    case "text":
      return "Rich text";
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "pricing":
      return "Pricing";
    case "packages":
      return "Packages";
    case "form":
      return "Form";
    case "signature":
      return "Signature";
    case "embed":
      return "Embed";
    case "payment":
      return "Payment";
    case "divider":
      return "Divider";
    case "spacer":
      return "Spacer";
    case "accordion":
      return "Accordion";
    case "columns":
      return "Columns";
    case "icon":
      return "Icon";
    case "section":
      return "Section";
    default:
      return "Block";
  }
}

/** CRM proposal edit page: back link, status, recipient, public link + save actions in one top row. */
export type ProposalEditShellToolbarProps = {
  customerBackHref: string | null;
  recipientEmail: string | null;
  shareToken: string | null;
};

export interface ProposalDocumentEditorProps {
  variant?: "proposal" | "template";
  proposalId?: string;
  templateId?: string;
  initialTemplateName?: string;
  initialTemplateDescription?: string;
  initialDocument: ProposalDocument;
  initialStatus?: string;
  proposalEditShellToolbar?: ProposalEditShellToolbarProps;
  /** Rendered between the proposal toolbar and block tabs (e.g. summary + share grid from the server page). */
  proposalEditMiddleSlot?: ReactNode;
}

export function ProposalDocumentEditor({
  variant = "proposal",
  proposalId,
  templateId,
  initialTemplateName = "",
  initialTemplateDescription = "",
  initialDocument,
  initialStatus = "draft",
  proposalEditShellToolbar,
  proposalEditMiddleSlot,
}: ProposalDocumentEditorProps) {
  const isTemplate = variant === "template";
  const [templateName, setTemplateName] = React.useState(initialTemplateName);
  const [templateNameEditing, setTemplateNameEditing] = React.useState(false);
  const skipNextTemplateNameBlurSaveRef = React.useRef(false);
  const [blocks, setBlocks] = React.useState<ProposalBlock[]>(initialDocument.blocks);
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
  const [rootColumnsLayoutEditingId, setRootColumnsLayoutEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  React.useEffect(() => {
    if (rootColumnsLayoutEditingId && !blocks.some((b) => b.id === rootColumnsLayoutEditingId)) {
      setRootColumnsLayoutEditingId(null);
    }
  }, [blocks, rootColumnsLayoutEditingId]);

  const proposalTitleFrozenRef = React.useRef<string | null>(null);
  const documentTitle = React.useMemo(() => {
    if (isTemplate) {
      return templateName.trim() || "Untitled template";
    }
    if (proposalTitleFrozenRef.current === null) {
      proposalTitleFrozenRef.current =
        (initialDocument.title ?? "").trim() || "Untitled proposal";
    }
    return proposalTitleFrozenRef.current;
  }, [isTemplate, templateName, initialDocument.title]);
  const doc: ProposalDocument = React.useMemo(
    () => ({ title: documentTitle, blocks }),
    [documentTitle, blocks],
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((items) => {
      const oldIndex = items.findIndex((b) => b.id === active.id);
      const newIndex = items.findIndex((b) => b.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    if (isTemplate) {
      if (!templateId) {
        setSaving(false);
        setMessage("Missing template id.");
        return;
      }
      const res = await saveProposalTemplateAction({
        templateId,
        name: templateName.trim() || "Untitled template",
        description: initialTemplateDescription?.trim() || undefined,
        title: documentTitle,
        document: doc,
      });
      setSaving(false);
      setMessage(res.ok ? "Template saved." : res.message);
      return;
    }
    if (!proposalId) {
      setSaving(false);
      setMessage("Missing proposal id.");
      return;
    }
    const res = await saveProposalDocumentAction({
      proposalId,
      title: documentTitle,
      document: doc,
    });
    setSaving(false);
    setMessage(res.ok ? "Saved." : res.message);
  }

  async function saveAndExitTemplateNameEdit() {
    if (!isTemplate || !templateId) return;
    setTemplateNameEditing(false);
    await save();
  }

  async function send() {
    if (isTemplate || !proposalId) return;
    setSending(true);
    setMessage(null);
    const saved = await saveProposalDocumentAction({ proposalId, title: documentTitle, document: doc });
    if (!saved.ok) {
      setSending(false);
      setMessage(saved.message);
      return;
    }
    const sent = await sendProposalAction(proposalId);
    setSending(false);
    setMessage(sent.ok ? "Published — link is live for customers." : sent.message);
  }

  function updateBlock(id: string, next: ProposalBlock) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));
  }

  function patchSectionBackdrop(id: string, nextBackdrop: SectionBackground | undefined) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id || b.type !== "section") return b;
        if (!nextBackdrop) {
          const { background: _drop, ...rest } = b;
          void _drop;
          return rest as ProposalBlock;
        }
        return { ...b, background: nextBackdrop } as ProposalBlock;
      }),
    );
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedBlockId((current) => (current === id ? null : current));
    setRootColumnsLayoutEditingId((current) => (current === id ? null : current));
  }

  function addBlockAt(block: ProposalBlock, index: number) {
    setBlocks((prev) => {
      const next = [...prev];
      const safeIndex = Math.max(0, Math.min(index, next.length));
      next.splice(safeIndex, 0, block);
      return next;
    });
  }

  function moveBlock(id: string, direction: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, idx, target);
    });
  }

  /** Duplicate the block immediately after the source. New ids are minted recursively. */
  function duplicateBlock(id: string) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const source = prev[idx];
      const cloned = cloneBlockWithFreshIds(source);
      const next = [...prev];
      next.splice(idx + 1, 0, cloned);
      return next;
    });
    setSelectedBlockId(null);
  }

  function applyBlockStyle(id: string, style: BlockStyle | undefined) {
    function applyStyleToStacks(stacks: ProposalColumnChildBlock[]): ProposalColumnChildBlock[] {
      return stacks.map((c) => {
        if (c.id !== id) return c;
        if (c.type !== "packages") return c;
        if (style === undefined) {
          const { style: _drop, ...rest } = c;
          void _drop;
          return rest as ProposalColumnChildBlock;
        }
        return { ...c, style } as ProposalColumnChildBlock;
      });
    }

    function patchNestedContent(children: ProposalContentBlock[]): ProposalContentBlock[] | null {
      let changed = false;
      const next = children.map((c): ProposalContentBlock => {
        if (c.id === id && c.type === "packages") {
          changed = true;
          if (style === undefined) {
            const { style: _drop, ...rest } = c;
            void _drop;
            return rest as ProposalContentBlock;
          }
          return { ...c, style } as ProposalContentBlock;
        }
        if (c.type === "columns") {
          const nextStacks = c.stacks.map((stack) => applyStyleToStacks(stack));
          if (nextStacks.some((s, i) => s !== c.stacks[i])) {
            changed = true;
            return { ...c, stacks: nextStacks };
          }
        }
        return c;
      });
      return changed ? next : null;
    }

    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          if (b.type === "packages") {
            if (style === undefined) {
              const { style: _drop, ...rest } = b;
              void _drop;
              return rest as ProposalBlock;
            }
            return { ...b, style } as ProposalBlock;
          }
          return b;
        }
        if (b.type === "section") {
          const patched = patchNestedContent(b.children);
          if (patched) return { ...b, children: patched };
          return b;
        }
        if (b.type === "columns") {
          const nextStacks = b.stacks.map((stack) => applyStyleToStacks(stack));
          if (nextStacks.some((s, i) => s !== b.stacks[i])) {
            return { ...b, stacks: nextStacks };
          }
          return b;
        }
        return b;
      }),
    );
  }

  function getBlockStyle(block: ProposalBlock): BlockStyle | undefined {
    if (block.type === "packages") {
      return block.style;
    }
    return undefined;
  }

  return (
    <div className="space-y-6">
      {isTemplate && templateId ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link href="/admin/templates">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                All templates
              </Link>
            </Button>
            <div className="flex h-8 min-w-[10rem] flex-1 basis-[14rem] items-center border-b border-border">
              {templateNameEditing ? (
                <Input
                  autoFocus
                  aria-label="Template name"
                  value={templateName}
                  disabled={saving}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onBlur={() => {
                    if (skipNextTemplateNameBlurSaveRef.current) {
                      skipNextTemplateNameBlurSaveRef.current = false;
                      return;
                    }
                    void saveAndExitTemplateNameEdit();
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    skipNextTemplateNameBlurSaveRef.current = true;
                    void saveAndExitTemplateNameEdit();
                  }}
                  placeholder="Template name"
                  className="h-8 border-0 bg-transparent px-0 text-xs font-medium text-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  aria-label="Edit template name"
                  onClick={() => setTemplateNameEditing(true)}
                  className="flex h-8 w-full min-w-0 items-center gap-2 rounded-sm text-left text-xs font-medium outline-none ring-offset-background transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {templateName.trim() || "Untitled template"}
                  </span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              )}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <DeleteProposalTemplateButton
                templateId={templateId}
                templateName={templateName.trim() || initialTemplateName || "Untitled template"}
              />
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link
                  href={`/admin/templates/${templateId}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Open public viewer
                </Link>
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void save()} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
          </div>
          {message ? <span className="block text-sm text-muted-foreground">{message}</span> : null}
        </>
      ) : proposalEditShellToolbar ? (
        <>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {proposalEditShellToolbar.customerBackHref ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <Link href={proposalEditShellToolbar.customerBackHref}>
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back to customer
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {proposalEditShellToolbar.shareToken ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <Link
                    href={`/p/${encodeURIComponent(proposalEditShellToolbar.shareToken)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open public viewer
                  </Link>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={sending}
                onClick={() => void send()}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                Save & publish
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void save()} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
          </div>
          {message ? <span className="block text-sm text-muted-foreground">{message}</span> : null}
          {initialStatus === "draft" ? (
            <p className="text-xs text-muted-foreground">
              Save &amp; publish sends the public link, records engagement, and moves a linked opportunity to the Proposal
              stage.
            </p>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={saving} onClick={() => void save()} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          {!isTemplate ? (
            <Button type="button" variant="secondary" disabled={sending} onClick={() => void send()} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Save & publish
            </Button>
          ) : null}
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
          {!isTemplate && initialStatus === "draft" ? (
            <p className="w-full text-xs text-muted-foreground">
              Save &amp; publish sends the public link, records engagement, and moves a linked opportunity to the Proposal
              stage.
            </p>
          ) : null}
        </div>
      )}

      {proposalEditMiddleSlot}

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit blocks</TabsTrigger>
          <TabsTrigger value="preview">Live preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="mt-4">
          <TooltipProvider delayDuration={280}>
          {blocks.length === 0 ? (
            <InsertBlockSlot variant="empty" onAdd={(b) => addBlockAt(b, 0)} />
          ) : (
            <div
              onClick={() => {
                setSelectedBlockId(null);
                setRootColumnsLayoutEditingId(null);
              }}
            >
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <InsertBlockSlot onAdd={(b) => addBlockAt(b, 0)} />
                  {blocks.map((block, idx) => {
                    const isSelected = selectedBlockId === block.id;
                    const supportsStyle = block.type === "packages";
                    return (
                      <div key={block.id}>
                        <SortableShell
                          id={block.id}
                          selected={isSelected}
                          onSelect={() => {
                            setRootColumnsLayoutEditingId((prev) =>
                              prev !== null && prev !== block.id ? null : prev,
                            );
                            setSelectedBlockId(block.id);
                          }}
                          toolbar={({ dragAttributes, dragListeners }) => {
                            const isSection = block.type === "section";
                            const dragHandle = (
                              <Tooltip delayDuration={320}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="touch-none inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                                    aria-label={`Reorder ${blockLabel(block.type)}`}
                                    {...dragAttributes}
                                    {...dragListeners}
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                  Drag to reposition · arrows nudge precisely
                                </TooltipContent>
                              </Tooltip>
                            );
                            const compactColumnsChrome = block.type === "columns";
                            return (
                            <BlockToolbar
                              appearance="surface"
                              blockType={
                                block.type === "pricing"
                                  ? "pricing"
                                  : block.type === "packages"
                                    ? "packages"
                                    : block.type === "section"
                                      ? "section"
                                      : "other"
                              }
                              deleteLabel={
                                block.type === "section" ? "Remove section" : "Delete block"
                              }
                              canMoveUp={idx > 0}
                              canMoveDown={idx < blocks.length - 1}
                              onMoveUp={() => moveBlock(block.id, -1)}
                              onMoveDown={() => moveBlock(block.id, 1)}
                              onDuplicate={() => duplicateBlock(block.id)}
                              onDelete={() => removeBlock(block.id)}
                              compactChrome={compactColumnsChrome}
                              compactPrimarySlot={
                                compactColumnsChrome ? (
                                  rootColumnsLayoutEditingId === block.id ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRootColumnsLayoutEditingId(null);
                                        }}
                                        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-500/15 dark:text-teal-400 dark:hover:bg-teal-500/10"
                                      >
                                        <Check className="h-4 w-4 shrink-0" aria-hidden />
                                        Done
                                      </button>
                                      <ColumnsBlockLayoutControls
                                        block={blocks.find((b) => b.id === block.id) as ColumnsBlock}
                                        onPatch={(patch) => {
                                          const cur = blocks.find((b) => b.id === block.id);
                                          if (!cur || cur.type !== "columns") return;
                                          updateBlock(block.id, { ...cur, ...patch });
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRootColumnsLayoutEditingId(block.id);
                                      }}
                                      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                                    >
                                      <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                                      Edit columns
                                    </button>
                                  )
                                ) : undefined
                              }
                              overflowLeadingAction={
                                block.type === "packages" && packagesAddonsSectionActive(block as PackagesBlock)
                                  ? {
                                      label: "Remove add-ons table",
                                      onClick: () => {
                                        const p = block as PackagesBlock;
                                        updateBlock(block.id, { ...p, addonsSectionEnabled: false });
                                      },
                                    }
                                  : undefined
                              }
                              showOverflowMenu={!isSection}
                              style={supportsStyle ? getBlockStyle(block) : undefined}
                              onStyleChange={
                                supportsStyle ? (next) => applyBlockStyle(block.id, next) : undefined
                              }
                              backdropPickerSlot={
                                block.type === "section" ? (
                                  <ProposalSectionBackgroundPicker
                                    background={block.background}
                                    onChange={(next) => patchSectionBackdrop(block.id, next)}
                                  />
                                ) : block.type === "splash" ? (
                                  <ProposalSplashBackgroundPicker
                                    block={block as SplashBlock}
                                    onChange={(next) => updateBlock(block.id, next)}
                                  />
                                ) : undefined
                              }
                              leadingSlot={isSection ? dragHandle : undefined}
                              trailingSlot={isSection ? undefined : dragHandle}
                            />
                            );
                          }}
                        >
                          <BlockFields
                            block={block}
                            onChange={(next) => updateBlock(block.id, next)}
                            selection={{
                              selectedId: selectedBlockId,
                              onSelect: setSelectedBlockId,
                            }}
                            getBlockStyle={getBlockStyle}
                            applyBlockStyle={applyBlockStyle}
                            columnsLayoutEditing={{
                              activeId: rootColumnsLayoutEditingId,
                              setActiveId: setRootColumnsLayoutEditingId,
                            }}
                          />
                        </SortableShell>
                        <InsertBlockSlot onAdd={(b) => addBlockAt(b, idx + 1)} />
                      </div>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          )}
          </TooltipProvider>
        </TabsContent>
        <TabsContent
          value="preview"
          className="mt-4 overflow-x-visible rounded-2xl border border-border/70 bg-muted/15 py-6 md:py-10"
        >
          <div className={PROPOSAL_PUBLIC_DOCUMENT_OUTER_CLASSES}>
            <ProposalDocumentView document={doc} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
