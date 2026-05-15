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
  AlignCenter,
  AlignLeft,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  CreditCard,
  ExternalLink,
  FileText,
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
  AgreementBlock,
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
  ProposalAgreementChildBlock,
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
import type { SubscriptionProductOption } from "@/types/subscription-product";
import { ProposalRichText } from "@/components/proposal/proposal-rich-text";
import { ProposalDocumentView } from "@/components/proposal/proposal-document-view";
import { ProposalSectionShell } from "@/components/proposal/proposal-section-shell";
import { ProposalMediaLibraryProvider } from "@/components/proposal/proposal-media-library";
import {
  ProposalContractTemplateLibraryProvider,
  useProposalContractTemplateLibraryOptional,
  type ContractTemplatePick,
} from "@/components/proposal/proposal-contract-template-library";
import {
  PROPOSAL_IMAGE_BLOCK_PLACEHOLDER_URL,
  ProposalImageBlockEditor,
} from "@/components/proposal/proposal-image-block-editor";
import { ProposalImageBlockToolbar } from "@/components/proposal/proposal-image-block-toolbar";
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
  PROPOSAL_EDITOR_BLOCK_CANVAS_INNER_CLASSES,
  PROPOSAL_PUBLIC_DOCUMENT_OUTER_CLASSES,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { escapeHtml } from "@/lib/escape-html";
import {
  DEFAULT_AGREEMENT_BUTTON_COLOR,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  readableForeground,
  resolveAgreementButtonColor,
  STYLE_PRESET_COLORS,
} from "@/lib/block-style";
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
import { EditorStripeCatalogContext } from "@/components/proposal/editor-stripe-catalog-context";

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
    case "agreement":
      return {
        ...block,
        id: newId(),
        children: (block as AgreementBlock).children.map(
          (c) => cloneBlockWithFreshIds(c as ProposalBlock) as ProposalAgreementChildBlock,
        ),
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
  { id: "agreement", type: "agreement", label: "Accept", icon: PenLine, accent: "text-cyan-500", accentBg: "bg-cyan-500/10" },
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

/** Insert menu inside columns — Qwilr-style dark popover (Content / Interactive). */
const COLUMN_MENU_CONTENT: BlockOption[] = [
  { id: "col-text", type: "text", label: "Text", icon: ScrollText, accent: "text-violet-500", accentBg: "bg-violet-500/10" },
  { id: "col-heading", type: "header", label: "Heading", icon: Heading, accent: "text-sky-500", accentBg: "bg-sky-500/10" },
  { id: "col-image", type: "image", label: "Image", icon: ImageIcon, accent: "text-fuchsia-500", accentBg: "bg-fuchsia-500/10" },
  { id: "col-video", type: "video", label: "Video", icon: MonitorPlay, accent: "text-rose-500", accentBg: "bg-rose-500/10" },
  { id: "col-icon", type: "icon", label: "Icon", icon: Star, accent: "text-yellow-500", accentBg: "bg-yellow-500/10" },
  { id: "col-divider", type: "divider", label: "Divider", icon: SeparatorHorizontal, accent: "text-slate-400", accentBg: "bg-slate-500/10" },
  { id: "col-spacer", type: "spacer", label: "Spacer", icon: MoveVertical, accent: "text-zinc-400", accentBg: "bg-zinc-500/10" },
  { id: "col-pricing", type: "pricing", label: "Quote", icon: Coins, accent: "text-emerald-500", accentBg: "bg-emerald-500/10" },
  { id: "col-packages", type: "packages", label: "Plans", icon: Package, accent: "text-amber-500", accentBg: "bg-amber-500/10" },
];

const COLUMN_MENU_INTERACTIVE: BlockOption[] = [
  { id: "col-embed", type: "embed", label: "Embed", icon: LayoutTemplate, accent: "text-teal-500", accentBg: "bg-teal-500/10" },
  { id: "col-form", type: "form", label: "Form", icon: SquarePen, accent: "text-indigo-500", accentBg: "bg-indigo-500/10" },
  { id: "col-payment", type: "payment", label: "Payment", icon: CreditCard, accent: "text-orange-500", accentBg: "bg-orange-500/10" },
  { id: "col-agreement", type: "agreement", label: "Accept", icon: PenLine, accent: "text-cyan-500", accentBg: "bg-cyan-500/10" },
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
      return { id, type: "image", url: PROPOSAL_IMAGE_BLOCK_PLACEHOLDER_URL, alt: "" };
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
    case "agreement":
      return {
        id,
        type: "agreement",
        children: [],
        buttonLabel: "View Agreement",
        requireAcceptTerms: true,
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
  /** When false, the floating toolbar shows only while the block is selected (not on hover). Used for image blocks. */
  toolbarShowOnHover = true,
}: {
  id: string;
  children: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  toolbar?: (ctx: {
    dragAttributes: DraggableAttributes;
    dragListeners: DraggableSyntheticListeners;
  }) => React.ReactNode;
  toolbarShowOnHover?: boolean;
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
  const showToolbar = Boolean(toolbar && (selected || (toolbarShowOnHover && hovered)));

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

function ColumnInsertMenu({
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
          "w-[min(220px,calc(100vw-2rem))] overflow-hidden rounded-lg border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-xl",
        )}
        onCloseAutoFocus={(event: Event) => event.preventDefault()}
      >
        <p className="px-2.5 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Content</p>
        <div className="pb-1">
          {COLUMN_MENU_CONTENT.map((opt) => (
            <DarkInsertRow key={opt.id} icon={opt.icon} label={opt.label} onPick={() => pick(opt)} />
          ))}
        </div>
        <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Interactive</p>
        <div className="pb-1">
          {COLUMN_MENU_INTERACTIVE.map((opt) => (
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

function findColumnCellMeta(
  col: ColumnsBlock,
  cellId: string | null,
): { ci: number; si: number; child: ProposalColumnChildBlock } | null {
  if (!cellId) return null;
  for (let ci = 0; ci < col.stacks.length; ci++) {
    const si = col.stacks[ci].findIndex((c) => c.id === cellId);
    if (si >= 0) return { ci, si, child: col.stacks[ci][si] };
  }
  return null;
}

/** True when `applyStyleToStacks`-style mapping replaced at least one cell reference. */
function columnStacksHaveCellUpdates(
  prevStacks: ProposalColumnChildBlock[][],
  nextStacks: ProposalColumnChildBlock[][],
): boolean {
  if (prevStacks.length !== nextStacks.length) return true;
  for (let i = 0; i < nextStacks.length; i++) {
    const row = nextStacks[i];
    const prevRow = prevStacks[i];
    if (row.length !== prevRow.length) return true;
    for (let j = 0; j < row.length; j++) {
      if (row[j] !== prevRow[j]) return true;
    }
  }
  return false;
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

function ColumnGhostText({ onSeed, placeholder }: { onSeed: (block: TextBlock) => void; placeholder: string }) {
  const idRef = React.useRef(newId());
  const [html, setHtml] = React.useState("<p></p>");
  return (
    <ProposalRichText
      html={html}
      placeholder={placeholder}
      onChange={(next) => {
        setHtml(next);
        onSeed({ id: idRef.current, type: "text", html: next, body: undefined });
      }}
    />
  );
}

type ProposalImageColumnToolbarActions = {
  onRemove: () => void;
};

function NestedColumnBlockFields({
  block,
  onChange,
  textPlaceholder,
  cellSelection,
  imageColumnToolbar,
}: {
  block: ProposalColumnChildBlock;
  onChange: (next: ProposalColumnChildBlock) => void;
  /** Rich-text placeholder when this block is a column cell (Qwilr-style hint). */
  textPlaceholder?: string;
  /** Which cell in the columns layout is active (for image toolbar visibility). */
  cellSelection?: { selectedId: string | null; onSelect: (id: string | null) => void };
  /** When this cell is an image: remove action is shown on the image toolbar. */
  imageColumnToolbar?: ProposalImageColumnToolbarActions;
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
          placeholder={textPlaceholder}
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
          imageColumnToolbar={block.type === "image" ? imageColumnToolbar : undefined}
          selection={cellSelection}
        />
      );
  }
}

function ColumnPane({
  label,
  columnIndex,
  stack,
  onPatchColumnStack,
  selectedCellId,
  setSelectedCellId,
  setActiveColumnIndex,
}: {
  label: string;
  columnIndex: number;
  stack: ProposalColumnChildBlock[];
  onPatchColumnStack: (columnIndex: number, nextStack: ProposalColumnChildBlock[]) => void;
  selectedCellId: string | null;
  setSelectedCellId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveColumnIndex: React.Dispatch<React.SetStateAction<number>>;
}) {
  function setStack(next: ProposalColumnChildBlock[]) {
    onPatchColumnStack(columnIndex, next);
  }
  function removeAt(id: string) {
    setSelectedCellId((cur) => (cur === id ? null : cur));
    setStack(stack.filter((x) => x.id !== id));
  }
  function updateChild(childId: string, nextChild: ProposalColumnChildBlock) {
    setStack(stack.map((c) => (c.id === childId ? nextChild : c)));
  }
  const cellSelection = React.useMemo(
    () => ({ selectedId: selectedCellId, onSelect: setSelectedCellId }),
    [selectedCellId, setSelectedCellId],
  );
  return (
    <div
      className="min-w-0"
      onPointerDownCapture={() => {
        setActiveColumnIndex(columnIndex);
        if (stack.length === 0) setSelectedCellId(null);
      }}
    >
      <span className="sr-only">{label}</span>
      <div className="min-w-0 space-y-4">
        {stack.length === 0 ? (
          <ColumnGhostText
            placeholder="Type / to add content"
            onSeed={(tb) => setStack([tb])}
          />
        ) : (
          stack.map((child) => (
            <div
              key={child.id}
              className="space-y-2"
              onPointerDownCapture={() => {
                setSelectedCellId(child.id);
                setActiveColumnIndex(columnIndex);
              }}
            >
              <NestedColumnBlockFields
                block={child}
                onChange={(n) => updateChild(child.id, n)}
                textPlaceholder="Type / to add content"
                cellSelection={cellSelection}
                imageColumnToolbar={
                  child.type === "image"
                    ? {
                        onRemove: () => removeAt(child.id),
                      }
                    : undefined
                }
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ColumnsBlockFields({
  block,
  onChange,
  resizeLayoutActive,
  onExitResizeLayout,
  ancestorSelectedBlockId,
}: {
  block: ColumnsBlock;
  onChange: (next: ColumnsBlock) => void;
  resizeLayoutActive?: boolean;
  onExitResizeLayout?: () => void;
  /** Section/root selected block id — used to clear inner column cell selection when focus leaves this columns block. */
  ancestorSelectedBlockId: string | null;
}) {
  const columnCount = block.stacks.length as ColumnLayoutCount;
  const resizeMode = Boolean(resizeLayoutActive);
  const columnWidthRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const blockRef = React.useRef(block);
  blockRef.current = block;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const [dragDividerIndex, setDragDividerIndex] = React.useState<number | null>(null);
  const [selectedCellId, setSelectedCellId] = React.useState<string | null>(null);
  const [activeColumnIndex, setActiveColumnIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveColumnIndex((i) =>
      block.stacks.length <= 0 ? 0 : Math.min(Math.max(0, i), block.stacks.length - 1),
    );
  }, [block.stacks.length]);

  const selectedCellMeta = React.useMemo(
    () => findColumnCellMeta(block, selectedCellId),
    [block, selectedCellId],
  );

  React.useEffect(() => {
    if (ancestorSelectedBlockId !== block.id) setSelectedCellId(null);
  }, [ancestorSelectedBlockId, block.id]);

  React.useEffect(() => {
    const ids = new Set(block.stacks.flatMap((s) => s.map((c) => c.id)));
    if (selectedCellId && !ids.has(selectedCellId)) setSelectedCellId(null);
  }, [block.stacks, selectedCellId]);

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

  const flexRow = coerceColumnFlex(columnCount, block.columnFlex);
  const flexPercents = resizeMode ? columnFlexPercents(flexRow) : [];

  return (
    <div className="space-y-6">
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
            {block.stacks.map((stack, i) => {
              const showInsertHere = !resizeMode && activeColumnIndex === i;
              const showPlansHere =
                !resizeMode &&
                selectedCellMeta?.child.type === "packages" &&
                selectedCellMeta.ci === i;
              const showColumnLeftRail = showInsertHere || showPlansHere;
              return (
              <React.Fragment key={`${block.id}-col-${i}`}>
                <div
                  ref={(el) => {
                    columnWidthRefs.current[i] = el;
                  }}
                  onPointerDownCapture={() => setActiveColumnIndex(i)}
                  className={cn(
                    "relative min-w-0 md:min-w-[3.5rem]",
                    !resizeMode &&
                      cn(
                        "group/colcell rounded-md border border-transparent p-1 md:p-2",
                        "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
                        "hover:border-border/65 hover:bg-muted/25 hover:shadow-sm",
                        "focus-within:border-border/80 focus-within:bg-muted/20 focus-within:shadow-sm",
                        "dark:hover:bg-muted/15 dark:focus-within:bg-muted/15",
                      ),
                    resizeMode &&
                      "rounded-lg border border-sky-400/40 bg-background/60 py-1 ring-1 ring-sky-500/20 dark:bg-background/40 md:px-0 md:py-1",
                  )}
                  style={{ flex: `${flexRow[i]} 1 0%` } as React.CSSProperties}
                >
                  {showColumnLeftRail ? (
                    <div className="pointer-events-none absolute right-full top-1/2 z-20 -mr-1 flex -translate-y-1/2 flex-col items-center gap-2 sm:-mr-1.5">
                      <div className="pointer-events-auto flex flex-col items-center gap-2">
                        {showInsertHere ? (
                          <ColumnInsertMenu
                            onAdd={(insert) => {
                              const st = block.stacks[i];
                              if (!st) return;
                              onChange(
                                patchColumnStackAtIndex(block, i, [
                                  ...st,
                                  insert as ProposalColumnChildBlock,
                                ]),
                              );
                            }}
                            align="start"
                            trigger={
                              <button
                                type="button"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted/50 text-muted-foreground shadow-sm transition-colors hover:border-sky-500/50 hover:bg-background hover:text-foreground data-[state=open]:border-primary data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
                                aria-label="Add content"
                                title={`Add block to column ${i + 1}`}
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                              </button>
                            }
                          />
                        ) : null}
                        {showPlansHere ? (
                          <div
                            className="w-[min(14rem,calc(100vw-3rem))] space-y-1.5 rounded-xl border border-border/70 bg-muted/95 p-2.5 shadow-sm ring-1 ring-black/[0.04] backdrop-blur-sm dark:bg-zinc-800/95 dark:ring-white/10"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Plans background
                            </span>
                            <ProposalSectionBackgroundPicker
                              background={(selectedCellMeta.child as PackagesBlock).background}
                              onChange={(next) => {
                                const { ci, child } = selectedCellMeta;
                                const st = block.stacks[ci];
                                const nextSt = st.map((c) => {
                                  if (c.id !== child.id) return c;
                                  const p = c as PackagesBlock;
                                  if (!next) {
                                    const { background: _b, ...rest } = p;
                                    void _b;
                                    return rest as ProposalColumnChildBlock;
                                  }
                                  return { ...p, background: next } as ProposalColumnChildBlock;
                                });
                                onChange(patchColumnStackAtIndex(block, ci, nextSt));
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <ColumnPane
                    label={`Column ${i + 1}`}
                    columnIndex={i}
                    stack={stack}
                    onPatchColumnStack={(ci, nextStack) => onChange(patchColumnStackAtIndex(block, ci, nextStack))}
                    selectedCellId={selectedCellId}
                    setSelectedCellId={setSelectedCellId}
                    setActiveColumnIndex={setActiveColumnIndex}
                  />
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
              );
            })}
          </div>
        );
        const chromedColumns = <div className="min-w-0">{columnRow}</div>;
        if (pad <= 0) return chromedColumns;
        return (
          <div className="rounded-lg" style={{ padding: pad }}>
            {chromedColumns}
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
  const sortableChildIds = React.useMemo(() => children.map((c) => c.id), [children]);
  const [columnsLayoutEditingId, setColumnsLayoutEditingId] = React.useState<string | null>(null);
  const contractTemplateLibrary = useProposalContractTemplateLibraryOptional();

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
        <SortableContext items={sortableChildIds} strategy={verticalListSortingStrategy}>
          <InsertBlockSlot context="section" variant="between" onAdd={(b) => addChildAt(b, 0)} />
          {children.map((child, idx) => {
            const isSelected = selectedBlockId === child.id;
            const supportsStyle = child.type === "packages";
            return (
              <div key={child.id}>
                <SortableShell
                  id={child.id}
                  selected={isSelected}
                  toolbarShowOnHover={child.type !== "image"}
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
                    if (child.type === "image") {
                      const ib = child as ImageBlock;
                      return (
                        <div className="flex w-full items-start gap-1.5">
                          {dragHandle}
                          <ProposalImageBlockToolbar
                            variant="shell"
                            block={ib}
                            onChange={(next) => updateChild(child.id, next as ProposalContentBlock)}
                            onDelete={() => removeChild(child.id)}
                          />
                        </div>
                      );
                    }
                    return (
                      <BlockToolbar
                        appearance="surface"
                        blockType={
                          child.type === "pricing"
                            ? "pricing"
                            : child.type === "packages"
                              ? "packages"
                              : child.type === "agreement"
                                ? "agreement"
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
                                  block={child as ColumnsBlock}
                                  onPatch={(patch) => {
                                    if (child.type !== "columns") return;
                                    updateChild(child.id, { ...child, ...patch } as ProposalContentBlock);
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
                        auxiliarySlot={(() => {
                          const agreementSlot =
                            child.type === "agreement" && contractTemplateLibrary ? (
                              <Tooltip delayDuration={320}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                                    onClick={() => {
                                      const ab = child as AgreementBlock;
                                      contractTemplateLibrary.openSelection({
                                        onSelect: (pick) =>
                                          updateChild(
                                            child.id,
                                            applyContractTemplatePickToAgreementBlock(ab, pick),
                                          ),
                                      });
                                    }}
                                    aria-label="Open contract template library"
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    Contract
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                  Choose a contract from your library (snapshots legal text onto this block)
                                </TooltipContent>
                              </Tooltip>
                            ) : null;
                          const packagesSlot =
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
                            ) : null;
                          if (!agreementSlot && !packagesSlot) return undefined;
                          return (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              {agreementSlot}
                              {packagesSlot}
                            </span>
                          );
                        })()}
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
                          ) : child.type === "packages" ? (
                            <ProposalSectionBackgroundPicker
                              background={(child as PackagesBlock).background}
                              onChange={(next) => {
                                const p = child as PackagesBlock;
                                if (!next) {
                                  const { background: _b, ...rest } = p;
                                  void _b;
                                  updateChild(child.id, rest as ProposalContentBlock);
                                } else {
                                  updateChild(child.id, { ...p, background: next } as ProposalContentBlock);
                                }
                              }}
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

function applyContractTemplatePickToAgreementBlock(block: AgreementBlock, pick: ContractTemplatePick): AgreementBlock {
  return {
    ...block,
    contractTemplateId: pick.id,
    contractTemplateLabel: pick.name.trim() || undefined,
    agreementTitle: pick.agreementTitle.trim() || block.agreementTitle?.trim() || undefined,
    introHtml: pick.introHtml.trim() ? pick.introHtml.trim() : undefined,
    legalHtml: pick.legalHtml,
  };
}

function agreementNormalizeColorInput(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^#?[0-9a-fA-F]{3}$/.test(v)) return `#${v.replace("#", "")}`;
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) return `#${v.replace("#", "")}`;
  if (/^[a-zA-Z]{3,32}$/.test(v)) return v.toLowerCase();
  return null;
}

function agreementNormalizeHexForCompare(s: string): string {
  const v = s.trim().replace(/^#/, "").toLowerCase();
  if (v.length === 3 && /^[0-9a-f]{3}$/.test(v)) {
    return `${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  }
  return v.length === 6 && /^[0-9a-f]{6}$/.test(v) ? v : "";
}

function agreementSwatchIsActive(swatch: string, current: string): boolean {
  const a = agreementNormalizeHexForCompare(swatch);
  const b = agreementNormalizeHexForCompare(current);
  return a !== "" && b !== "" && a === b;
}

function agreementHexForNativeColorInput(hex: string): string {
  const v = hex.trim().replace(/^#/, "");
  if (v.length === 3 && /^[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`.toLowerCase();
  }
  if (v.length === 6 && /^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return DEFAULT_AGREEMENT_BUTTON_COLOR;
}

function agreementNeedsLightCheck(hex: string): boolean {
  if (hex.toUpperCase() === "#FFFFFF" || hex.toUpperCase() === "#FFF") return false;
  if (hex.toUpperCase() === "#E2E8F0") return false;
  return true;
}

function AgreementSignButtonPreview({
  block,
  onChange,
}: {
  block: AgreementBlock;
  onChange: (next: AgreementBlock) => void;
}) {
  const ctaColor = resolveAgreementButtonColor(block.style);
  const fg = readableForeground(ctaColor);
  const label = block.buttonLabel?.trim() || "View Agreement";
  const align = block.buttonAlign ?? "center";
  const [hexDraft, setHexDraft] = React.useState(ctaColor);
  React.useEffect(() => setHexDraft(ctaColor), [ctaColor]);

  function commitHexDraft() {
    const next = agreementNormalizeColorInput(hexDraft);
    if (next) {
      onChange({ ...block, style: { ...block.style, primaryColor: next } });
      setHexDraft(next);
    } else {
      setHexDraft(ctaColor);
    }
  }

  function setPrimaryColor(next: string) {
    onChange({ ...block, style: { ...block.style, primaryColor: next } });
  }

  return (
    <Popover>
      <div className={cn("mt-3 flex w-full", align === "start" ? "justify-start" : "justify-center")}>
        <div className="relative inline-flex max-w-full">
          <div
            className="inline-flex h-10 min-w-0 max-w-full items-center justify-center rounded-lg px-5 text-sm font-semibold shadow-sm"
            style={{ backgroundColor: ctaColor, color: fg }}
          >
            <span className="truncate">{label}</span>
          </div>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="absolute -right-1.5 -top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Edit sign button"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          </PopoverTrigger>
        </div>
      </div>
      <PopoverContent className="w-80 p-4" align="end" side="right" sideOffset={10} collisionPadding={16}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`agreement-button-text-${block.id}`}>Button text</Label>
            <Input
              id={`agreement-button-text-${block.id}`}
              value={block.buttonLabel ?? ""}
              placeholder="View Agreement"
              maxLength={80}
              onChange={(e) => onChange({ ...block, buttonLabel: e.target.value })}
            />
          </div>
          <div>
            <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Button color
            </p>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {STYLE_PRESET_COLORS.map((c) => {
                const isActive = agreementSwatchIsActive(c.value, ctaColor);
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.label}
                    title={c.label}
                    onClick={() => setPrimaryColor(c.value)}
                    className={cn(
                      "relative h-8 w-8 rounded-full border border-border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "hover:scale-105",
                    )}
                    style={{ backgroundColor: c.value }}
                  >
                    {isActive ? (
                      <Check
                        className={cn(
                          "absolute inset-0 m-auto h-4 w-4",
                          agreementNeedsLightCheck(c.value) ? "text-white" : "text-zinc-900",
                        )}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-1.5">
              <input
                type="color"
                aria-label="Pick button colour"
                value={agreementHexForNativeColorInput(ctaColor)}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
              />
              <Input
                type="text"
                value={hexDraft}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={commitHexDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                spellCheck={false}
                className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                aria-label="Button colour hex value"
                placeholder="#4543F7"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...block, style: undefined })}
              className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Reset to default
            </button>
          </div>
          <div>
            <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Alignment</p>
            <div className="mt-2 inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                aria-pressed={align === "start"}
                onClick={() => onChange({ ...block, buttonAlign: "start" })}
                className={cn(
                  "inline-flex h-8 w-9 items-center justify-center rounded-md transition-colors",
                  align === "start"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-label="Align button left"
              >
                <AlignLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-pressed={align === "center"}
                onClick={() => onChange({ ...block, buttonAlign: undefined })}
                className={cn(
                  "inline-flex h-8 w-9 items-center justify-center rounded-md transition-colors",
                  align === "center"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-label="Align button center"
              >
                <AlignCenter className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Accept block settings: sign button appearance, contract template, acknowledgement
 * option. Layout above the button is edited as nested blocks in the Accept surface.
 */
function AgreementBlockEditor({
  block,
  onChange,
}: {
  block: AgreementBlock;
  onChange: (next: AgreementBlock) => void;
}) {
  const contractLib = useProposalContractTemplateLibraryOptional();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 py-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sign button
        </p>
        <AgreementSignButtonPreview block={block} onChange={onChange} />
        <p className="mt-3 text-[11px] text-muted-foreground">
          {block.contractTemplateLabel?.trim() ? (
            <>
              Opens the “{block.agreementTitle?.trim() || "Services Agreement"}” modal for the buyer to review
              &amp; sign.
            </>
          ) : (
            <>Attach a contract template to set the modal title and agreement copy. Buyers review &amp; sign in the modal.</>
          )}
          <span className="block">Use the pencil on the button to change its label, colour, and alignment.</span>
        </p>
      </div>

      {contractLib ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            {block.contractTemplateLabel?.trim() ? (
              <>
                Library template:{" "}
                <span className="font-medium text-foreground">{block.contractTemplateLabel.trim()}</span>
              </>
            ) : (
              <>Attach a template from your org&apos;s contract library — title, intro, and legal text are copied onto this block.</>
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() =>
              contractLib.openSelection({
                onSelect: (pick) => onChange(applyContractTemplatePickToAgreementBlock(block, pick)),
              })
            }
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Contract library…
          </Button>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={block.requireAcceptTerms !== false}
          onChange={(e) => onChange({ ...block, requireAcceptTerms: e.target.checked })}
        />
        Require &quot;I have read and agree&quot; checkbox before signing
      </label>
    </div>
  );
}

function AgreementBlockFields({
  block,
  onChange,
  selectedBlockId,
  onSelectBlock,
  getBlockStyle,
  applyBlockStyle,
}: {
  block: AgreementBlock;
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
  const sortableChildIds = React.useMemo(() => children.map((c) => c.id), [children]);
  const [columnsLayoutEditingId, setColumnsLayoutEditingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (columnsLayoutEditingId && !children.some((c) => c.id === columnsLayoutEditingId)) {
      setColumnsLayoutEditingId(null);
    }
  }, [children, columnsLayoutEditingId]);

  function setChildren(nextChildren: ProposalAgreementChildBlock[]) {
    onChange({ ...block, children: nextChildren });
  }

  function updateChild(childId: string, next: ProposalAgreementChildBlock) {
    setChildren(children.map((c) => (c.id === childId ? next : c)));
  }

  function removeChild(childId: string) {
    setChildren(children.filter((c) => c.id !== childId));
    if (selectedBlockId === childId) onSelectBlock(null);
    if (columnsLayoutEditingId === childId) setColumnsLayoutEditingId(null);
  }

  function addChildAt(b: ProposalBlock, index: number) {
    if (b.type === "agreement") return;
    const c = b as ProposalAgreementChildBlock;
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
    const cloned = cloneBlockWithFreshIds(children[idx] as ProposalBlock) as ProposalAgreementChildBlock;
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

  const acceptStack =
    children.length === 0 ? (
      <div className="flex flex-col items-center gap-5 py-14 text-center">
        <div className="max-w-[20rem] space-y-1">
          <p className="text-sm font-medium text-foreground">Accept surface</p>
          <p className="text-xs text-muted-foreground">
            Add headings, prose, columns, dividers, and spacers above the sign button — the same building blocks as in a
            Section.
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
        <SortableContext items={sortableChildIds} strategy={verticalListSortingStrategy}>
          <InsertBlockSlot context="section" variant="between" onAdd={(b) => addChildAt(b, 0)} />
          {children.map((child, idx) => {
            const isSelected = selectedBlockId === child.id;
            const supportsStyle = child.type === "packages";
            return (
              <div key={child.id}>
                <SortableShell
                  id={child.id}
                  selected={isSelected}
                  toolbarShowOnHover={child.type !== "image"}
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
                    if (child.type === "image") {
                      const ib = child as ImageBlock;
                      return (
                        <div className="flex w-full items-start gap-1.5">
                          {dragHandle}
                          <ProposalImageBlockToolbar
                            variant="shell"
                            block={ib}
                            onChange={(next) => updateChild(child.id, next as ProposalAgreementChildBlock)}
                            onDelete={() => removeChild(child.id)}
                          />
                        </div>
                      );
                    }
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
                                  block={child as ColumnsBlock}
                                  onPatch={(patch) => {
                                    if (child.type !== "columns") return;
                                    updateChild(child.id, { ...child, ...patch } as ProposalAgreementChildBlock);
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
                        showOverflowMenu={false}
                        auxiliarySlot={(() => {
                          const packagesSlot =
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
                                      } as ProposalAgreementChildBlock);
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
                            ) : null;
                          return packagesSlot ?? undefined;
                        })()}
                        style={supportsStyle ? getBlockStyle(child) : undefined}
                        onStyleChange={
                          supportsStyle ? (next) => applyBlockStyle(child.id, next) : undefined
                        }
                        backdropPickerSlot={
                          child.type === "splash" ? (
                            <ProposalSplashBackgroundPicker
                              block={child as SplashBlock}
                              onChange={(next) =>
                                updateChild(child.id, next as ProposalAgreementChildBlock)
                              }
                            />
                          ) : child.type === "packages" ? (
                            <ProposalSectionBackgroundPicker
                              background={(child as PackagesBlock).background}
                              onChange={(next) => {
                                const p = child as PackagesBlock;
                                if (!next) {
                                  const { background: _b, ...rest } = p;
                                  void _b;
                                  updateChild(child.id, rest as ProposalAgreementChildBlock);
                                } else {
                                  updateChild(child.id, { ...p, background: next } as ProposalAgreementChildBlock);
                                }
                              }}
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
                    onChange={(next) => updateChild(child.id, next as ProposalAgreementChildBlock)}
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

  const settingsFooter = (
    <div className="border-t border-border/70 bg-muted/10 px-2 py-4 sm:px-3">
      <AgreementBlockEditor block={block} onChange={(next) => onChange(next)} />
    </div>
  );

  return (
    <ProposalSectionShell background={block.background} variant="editor">
      {backdropOn ? (
        <div className="flex min-w-0 flex-col">
          {acceptStack}
          {settingsFooter}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/65 bg-muted/15 px-1 py-1 sm:bg-muted/[0.35]">
          <div className="flex min-w-0 flex-col">
            {acceptStack}
            {settingsFooter}
          </div>
        </div>
      )}
    </ProposalSectionShell>
  );
}

function BlockFields({
  block,
  onChange,
  selection,
  getBlockStyle,
  applyBlockStyle,
  columnsLayoutEditing,
  imageColumnToolbar,
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
  /** Columns only: image remove is on {@link ProposalImageBlockToolbar}; duplicate/move stay on the column row. */
  imageColumnToolbar?: ProposalImageColumnToolbarActions;
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
      const col = imageColumnToolbar;
      const showEmbeddedColumnToolbar = Boolean(col) && selection?.selectedId === b.id;
      return (
        <div className="relative">
          {showEmbeddedColumnToolbar ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 -translate-y-full pb-1.5 pt-2">
              <div className="pointer-events-auto flex w-full flex-wrap items-start justify-end gap-1.5">
                <ProposalImageBlockToolbar
                  variant="embedded"
                  block={b}
                  onChange={patch}
                  onDelete={col?.onRemove}
                />
              </div>
            </div>
          ) : null}
          <ProposalImageBlockEditor block={b} onChange={patch} />
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
      const resolvedBg = resolveSectionBackground(b.background);
      const backdropOn = resolvedBg.active;
      const inner = (
        <div className={cn(!seamlessSection && PROPOSAL_EDITOR_BLOCK_CANVAS_INNER_CLASSES)}>
          <PackagesInlineEditor block={b} onChange={patch} />
        </div>
      );
      return (
        <ProposalSectionShell background={b.background} variant="editor">
          {backdropOn ? inner : (
            <div className="rounded-xl border border-dashed border-border/65 bg-muted/15 px-1 py-1 sm:bg-muted/[0.35]">
              {inner}
            </div>
          )}
        </ProposalSectionShell>
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
    case "agreement": {
      const b = block as AgreementBlock;
      return (
        <AgreementBlockFields
          block={b}
          onChange={patch}
          selectedBlockId={selection?.selectedId ?? null}
          onSelectBlock={selection?.onSelect ?? (() => {})}
          getBlockStyle={getBlockStyle ?? (() => undefined)}
          applyBlockStyle={applyBlockStyle ?? (() => {})}
        />
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
          ancestorSelectedBlockId={selection?.selectedId ?? null}
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
    case "agreement":
      return "Agreement";
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
  /** Settings → Locality IANA zone for preview tab agreement dates and merge-style display. */
  localityTimeZone?: string;
  /** Same Stripe products as **Add subscription** — used to link plan tiers to `prod_…`. */
  subscriptionProductOptions?: SubscriptionProductOption[];
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
  localityTimeZone,
  subscriptionProductOptions = [],
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
  const [publishJustSucceeded, setPublishJustSucceeded] = React.useState(false);
  const publishSuccessResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveJustSucceeded, setSaveJustSucceeded] = React.useState(false);
  const saveSuccessResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortableBlockIds = React.useMemo(() => blocks.map((b) => b.id), [blocks]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const contractTemplateLibrary = useProposalContractTemplateLibraryOptional();

  React.useEffect(() => {
    if (rootColumnsLayoutEditingId && !blocks.some((b) => b.id === rootColumnsLayoutEditingId)) {
      setRootColumnsLayoutEditingId(null);
    }
  }, [blocks, rootColumnsLayoutEditingId]);

  React.useEffect(() => {
    return () => {
      if (publishSuccessResetRef.current) {
        clearTimeout(publishSuccessResetRef.current);
      }
      if (saveSuccessResetRef.current) {
        clearTimeout(saveSuccessResetRef.current);
      }
    };
  }, []);

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
    if (saveSuccessResetRef.current) {
      clearTimeout(saveSuccessResetRef.current);
      saveSuccessResetRef.current = null;
    }
    setSaveJustSucceeded(false);
    const res = await saveProposalDocumentAction({
      proposalId,
      title: documentTitle,
      document: doc,
    });
    setSaving(false);
    setMessage(res.ok ? null : res.message);
    if (res.ok) {
      setSaveJustSucceeded(true);
      saveSuccessResetRef.current = setTimeout(() => {
        saveSuccessResetRef.current = null;
        setSaveJustSucceeded(false);
      }, 1800);
    }
  }

  async function saveAndExitTemplateNameEdit() {
    if (!isTemplate || !templateId) return;
    setTemplateNameEditing(false);
    await save();
  }

  async function send() {
    if (isTemplate || !proposalId) return;
    if (publishSuccessResetRef.current) {
      clearTimeout(publishSuccessResetRef.current);
      publishSuccessResetRef.current = null;
    }
    setPublishJustSucceeded(false);
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
    setMessage(sent.ok ? null : sent.message);
    if (sent.ok) {
      setPublishJustSucceeded(true);
      publishSuccessResetRef.current = setTimeout(() => {
        publishSuccessResetRef.current = null;
        setPublishJustSucceeded(false);
      }, 1800);
    }
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

  function patchPackagesBackdrop(id: string, nextBackdrop: SectionBackground | undefined) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id || b.type !== "packages") return b;
        if (!nextBackdrop) {
          const { background: _drop, ...rest } = b;
          void _drop;
          return rest as ProposalBlock;
        }
        return { ...b, background: nextBackdrop } as ProposalBlock;
      }),
    );
  }

  function patchAgreementBackdrop(id: string, nextBackdrop: SectionBackground | undefined) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id || b.type !== "agreement") return b;
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
    /** True when this block participates in the toolbar style picker (Plans only; Accept uses the sign-button inspector). */
    function blockTypeSupportsStyle(type: ProposalBlock["type"]): boolean {
      return type === "packages";
    }

    function applyStyleToStacks(stacks: ProposalColumnChildBlock[]): ProposalColumnChildBlock[] {
      return stacks.map((c) => {
        if (c.id !== id) return c;
        if (!blockTypeSupportsStyle(c.type)) return c;
        if (style === undefined) {
          const { style: _drop, ...rest } = c as ProposalColumnChildBlock & { style?: BlockStyle };
          void _drop;
          return rest as ProposalColumnChildBlock;
        }
        return { ...c, style } as ProposalColumnChildBlock;
      });
    }

    function patchNestedContent(children: ProposalContentBlock[]): ProposalContentBlock[] | null {
      let changed = false;
      const next = children.map((c): ProposalContentBlock => {
        if (c.id === id && blockTypeSupportsStyle(c.type)) {
          changed = true;
          if (style === undefined) {
            const { style: _drop, ...rest } = c as ProposalContentBlock & { style?: BlockStyle };
            void _drop;
            return rest as ProposalContentBlock;
          }
          return { ...c, style } as ProposalContentBlock;
        }
        if (c.type === "columns") {
          const nextStacks = c.stacks.map((stack) => applyStyleToStacks(stack));
          if (columnStacksHaveCellUpdates(c.stacks, nextStacks)) {
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
          if (blockTypeSupportsStyle(b.type)) {
            if (style === undefined) {
              const { style: _drop, ...rest } = b as ProposalBlock & { style?: BlockStyle };
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
          if (columnStacksHaveCellUpdates(b.stacks, nextStacks)) {
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
    <EditorStripeCatalogContext.Provider value={subscriptionProductOptions}>
    <ProposalMediaLibraryProvider>
    <ProposalContractTemplateLibraryProvider>
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
                  Preview
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
                    Preview
                  </Link>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={sending}
                onClick={() => void send()}
                className="min-w-[7rem] gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={publishJustSucceeded && !sending ? "Published" : "Publish"}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : publishJustSucceeded ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <Send className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {publishJustSucceeded && !sending ? "Published" : "Publish"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => void save()}
                className="min-w-[5.5rem] gap-2 transition-colors"
                aria-label={saveJustSucceeded && !saving ? "Saved" : "Save"}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : saveJustSucceeded ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {saveJustSucceeded && !saving ? "Saved" : "Save"}
              </Button>
            </div>
          </div>
          {message ? <span className="block text-sm text-muted-foreground">{message}</span> : null}
          {initialStatus === "draft" ? (
            <p className="text-xs text-muted-foreground">
              Publish sends the public link, records engagement, and moves a linked opportunity to the Proposal
              stage.
            </p>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="min-w-[5.5rem] gap-2 transition-colors"
            aria-label={saveJustSucceeded && !saving ? "Saved" : "Save"}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : saveJustSucceeded ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <Save className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {saveJustSucceeded && !saving ? "Saved" : "Save"}
          </Button>
          {!isTemplate ? (
            <Button
              type="button"
              variant="secondary"
              disabled={sending}
              onClick={() => void send()}
              className="min-w-[7rem] gap-2 transition-colors"
              aria-label={publishJustSucceeded && !sending ? "Published" : "Publish"}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : publishJustSucceeded ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <Send className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {publishJustSucceeded && !sending ? "Published" : "Publish"}
            </Button>
          ) : null}
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
          {!isTemplate && initialStatus === "draft" ? (
            <p className="w-full text-xs text-muted-foreground">
              Publish sends the public link, records engagement, and moves a linked opportunity to the Proposal
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
                <SortableContext items={sortableBlockIds} strategy={verticalListSortingStrategy}>
                  <InsertBlockSlot onAdd={(b) => addBlockAt(b, 0)} />
                  {blocks.map((block, idx) => {
                    const isSelected = selectedBlockId === block.id;
                    const supportsStyle = block.type === "packages";
                    return (
                      <div key={block.id}>
                        <SortableShell
                          id={block.id}
                          selected={isSelected}
                          toolbarShowOnHover={block.type !== "image"}
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
                            if (block.type === "image") {
                              const ib = block as ImageBlock;
                              return (
                                <div className="flex w-full items-start justify-end gap-1.5">
                                  <ProposalImageBlockToolbar
                                    variant="shell"
                                    block={ib}
                                    onChange={(next) => updateBlock(block.id, next)}
                                    onDelete={() => removeBlock(block.id)}
                                  />
                                  {dragHandle}
                                </div>
                              );
                            }
                            return (
                            <BlockToolbar
                              appearance="surface"
                              blockType={
                                block.type === "pricing"
                                  ? "pricing"
                                  : block.type === "packages"
                                    ? "packages"
                                    : block.type === "agreement"
                                      ? "agreement"
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
                                        block={block as ColumnsBlock}
                                        onPatch={(patch) => {
                                          if (block.type !== "columns") return;
                                          updateBlock(block.id, { ...block, ...patch });
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
                              overflowExtraItems={
                                block.type === "agreement" && contractTemplateLibrary
                                  ? [
                                      {
                                        label: "Change contract…",
                                        onClick: () => {
                                          const ab = block as AgreementBlock;
                                          contractTemplateLibrary.openSelection({
                                            onSelect: (pick) =>
                                              updateBlock(
                                                block.id,
                                                applyContractTemplatePickToAgreementBlock(ab, pick),
                                              ),
                                          });
                                        },
                                      },
                                    ]
                                  : undefined
                              }
                              showOverflowMenu={!isSection && block.type !== "splash"}
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
                                ) : block.type === "packages" ? (
                                  <ProposalSectionBackgroundPicker
                                    background={(block as PackagesBlock).background}
                                    onChange={(next) => patchPackagesBackdrop(block.id, next)}
                                  />
                                ) : block.type === "agreement" ? (
                                  <ProposalSectionBackgroundPicker
                                    background={(block as AgreementBlock).background}
                                    onChange={(next) => patchAgreementBackdrop(block.id, next)}
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
            <ProposalDocumentView document={doc} localityTimeZone={localityTimeZone} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </ProposalContractTemplateLibraryProvider>
    </ProposalMediaLibraryProvider>
    </EditorStripeCatalogContext.Provider>
  );
}
