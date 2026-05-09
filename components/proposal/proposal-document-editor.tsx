"use client";

import * as React from "react";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  MonitorPlay,
  Package,
  PenLine,
  Plus,
  Save,
  ScrollText,
  Send,
  SeparatorHorizontal,
  SquarePen,
  Star,
  TableProperties,
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
  TextBlock,
  VideoBlock,
} from "@/types/proposal";
import { ProposalRichText } from "@/components/proposal/proposal-rich-text";
import { ProposalDocumentView } from "@/components/proposal/proposal-document-view";
import { ProposalSectionShell } from "@/components/proposal/proposal-section-shell";
import { ProposalSectionBackgroundPicker } from "@/components/proposal/proposal-section-background-picker";
import {
  PackagesInlineEditor,
  PricingInlineEditor,
} from "@/components/proposal/proposal-block-inline-editors";
import { BlockToolbar } from "@/components/proposal/proposal-block-toolbar";
import { DeleteProposalTemplateButton } from "@/components/proposal/delete-proposal-template-button";
import { PROPOSAL_PUBLIC_CONTENT_CLASSES } from "@/lib/proposal-public-layout";
import { saveProposalDocumentAction, sendProposalAction } from "@/server/actions/proposal-builder";
import { saveProposalTemplateAction } from "@/server/actions/proposal-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { resolveSectionBackground } from "@/lib/section-background";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
    case "columns":
      return {
        ...block,
        id: newId(),
        left: block.left.map((c) => cloneBlockWithFreshIds(c as ProposalBlock) as ProposalColumnChildBlock),
        right: block.right.map((c) => cloneBlockWithFreshIds(c as ProposalBlock) as ProposalColumnChildBlock),
      };
    case "icon":
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

/** Pricing block presets: standard quote totals vs optional add-ons line-items table (interactive proposal). */
function createAddonsTableBlock(): ProposalBlock {
  const id = newId();
  return {
    id,
    type: "pricing",
    currency: "aud",
    title: "Add-ons",
    allowQuantityEdit: true,
    quantityUnitLabel: "Unit",
    style: {
      variant: "simple",
      primaryColor: DEFAULT_PRIMARY_COLOR,
      highlightColor: DEFAULT_HIGHLIGHT_COLOR,
    },
    lineItems: [
      { id: newId(), label: "3 User Pack", unitAmountMinor: 4_900, quantity: 0 },
      { id: newId(), label: "5 User Pack", unitAmountMinor: 7_900, quantity: 0 },
    ],
  };
}

/** Primary tile grid in the insert popover (includes Quote line items + optional add-ons table). */
const PRIMARY_BLOCK_OPTIONS: BlockOption[] = [
  { id: "text", type: "text", label: "Text", icon: ScrollText, accent: "text-violet-500", accentBg: "bg-violet-500/10" },
  { id: "header", type: "header", label: "Heading", icon: Heading, accent: "text-sky-500", accentBg: "bg-sky-500/10" },
  { id: "pricing-quote", type: "pricing", label: "Quote", icon: Coins, accent: "text-emerald-500", accentBg: "bg-emerald-500/10" },
  {
    id: "pricing-table",
    type: "pricing",
    label: "Table",
    icon: TableProperties,
    accent: "text-emerald-600",
    accentBg: "bg-emerald-500/10",
    factory: createAddonsTableBlock,
  },
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
    id: "sx-table",
    type: "pricing",
    label: "Table",
    icon: TableProperties,
    accent: "text-emerald-600",
    accentBg: "bg-emerald-500/10",
    factory: createAddonsTableBlock,
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
];

/** Secondary options revealed via "Add block from library". */
const LIBRARY_BLOCK_OPTIONS: BlockOption[] = [
  { id: "image", type: "image", label: "Image", icon: ImageIcon, accent: "text-fuchsia-500", accentBg: "bg-fuchsia-500/10" },
  { id: "form", type: "form", label: "Form", icon: SquarePen, accent: "text-indigo-500", accentBg: "bg-indigo-500/10" },
  { id: "embed", type: "embed", label: "Embed", icon: LayoutTemplate, accent: "text-teal-500", accentBg: "bg-teal-500/10" },
  { id: "payment", type: "payment", label: "Payment", icon: CreditCard, accent: "text-orange-500", accentBg: "bg-orange-500/10" },
  { id: "divider", type: "divider", label: "Divider", icon: SeparatorHorizontal, accent: "text-slate-400", accentBg: "bg-slate-500/10" },
];

function createBlock(type: ProposalBlock["type"]): ProposalBlock {
  const id = newId();
  switch (type) {
    case "header":
      return { id, type: "header", text: "Section heading" };
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
      return {
        id,
        type: "packages",
        currency: "aud",
        title: "Packages",
        plan12Label: "12 months",
        plan24Label: "24 months",
        tiers: [
          {
            id: t1,
            name: "Basic",
            includedUsers: 5,
            includedLocations: 1,
            includedAdmins: 1,
            monthlyCost12Minor: 600,
            monthlyCost24Minor: 500,
            upfrontCost12Minor: 1200,
            features: ["Email support"],
          },
          {
            id: t2,
            name: "Standard",
            includedUsers: 25,
            includedLocations: 3,
            includedAdmins: 2,
            monthlyCost12Minor: 1000,
            monthlyCost24Minor: 850,
            upfrontCost12Minor: 2500,
            recommended: true,
            features: ["24h support", "Onboarding session"],
          },
          {
            id: t3,
            name: "Premium",
            includedUsers: 100,
            includedLocations: 10,
            includedAdmins: 5,
            monthlyCost12Minor: 1700,
            monthlyCost24Minor: 1450,
            features: ["Priority support", "Dedicated success manager"],
          },
        ],
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
    case "accordion":
      return {
        id,
        type: "accordion",
        panels: [{ id: newId(), title: "Question", html: "<p></p>" }],
      };
    case "columns":
      return {
        id,
        type: "columns",
        left: [],
        right: [],
      };
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
          "relative rounded-lg px-2 py-2.5 transition-colors [-webkit-tap-highlight-color:transparent]",
          selected ? "bg-primary/[0.07] ring-1 ring-primary/35 dark:bg-primary/10" : "hover:bg-muted/45",
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
      className="cursor-pointer gap-2 rounded-none px-3 py-2.5 text-sm text-zinc-100 focus:bg-white/10 focus:text-white"
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        onPick();
      }}
      onSelect={(e: Event) => e.preventDefault()}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10">
        <Icon className="h-3.5 w-3.5 text-zinc-100" aria-hidden />
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
        sideOffset={6}
        className={cn(
          "w-[min(260px,calc(100vw-2rem))] border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-xl",
        )}
        onCloseAutoFocus={(event: Event) => event.preventDefault()}
      >
        <p className="border-b border-zinc-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Content
        </p>
        <div className="py-1">
          {SECTION_INSERT_OPTIONS.map((opt) => (
            <DarkInsertRow key={opt.id} icon={opt.icon} label={opt.label} onPick={() => pick(opt)} />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function patchColumnStacks(
  cols: ColumnsBlock,
  side: "left" | "right",
  stack: ProposalColumnChildBlock[],
): ColumnsBlock {
  return side === "left" ? { ...cols, left: stack } : { ...cols, right: stack };
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
    case "header":
      return <Input value={block.text} onChange={(e) => patchNested({ ...block, text: e.target.value })} />;
    case "text":
      return (
        <ProposalRichText
          html={block.html ?? (block.body ? `<p>${escapeHtml(block.body)}</p>` : "<p></p>")}
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
}: {
  block: ColumnsBlock;
  onChange: (next: ColumnsBlock) => void;
}) {
  function ColumnPane({
    label,
    side,
    stack,
  }: {
    label: string;
    side: "left" | "right";
    stack: ProposalColumnChildBlock[];
  }) {
    function setStack(next: ProposalColumnChildBlock[]) {
      onChange(patchColumnStacks(block, side, next));
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
      <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <SectionInsertMenu
            align="end"
            onAdd={addToEnd}
            trigger={
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            }
          />
        </div>
        {stack.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
            Empty · use{" "}
            <span className="font-semibold">
              Content → Add · <kbd className="rounded bg-muted px-1 font-sans text-[11px]">+</kbd>
            </span>
          </p>
        ) : (
          stack.map((child, idx) => (
            <div key={child.id} className="rounded-lg border border-border/50 bg-card/60 p-2">
              <div className="mb-2 flex flex-wrap gap-1">
                <Button type="button" variant="ghost" size="sm" disabled={idx === 0} onClick={() => move(child.id, -1)}>
                  Up
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={idx === stack.length - 1} onClick={() => move(child.id, 1)}>
                  Down
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => dup(child.id)}>
                  Duplicate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removeAt(child.id)}
                >
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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <ColumnPane label="Left column" side="left" stack={block.left} />
        <ColumnPane label="Right column" side="right" stack={block.right} />
      </div>
    </div>
  );
}

function AccordionBlockEditor({
  block,
  onChange,
}: {
  block: AccordionBlock;
  onChange: (next: AccordionBlock) => void;
}) {
  return (
    <div className="space-y-4">
      {(block.panels ?? []).map((p, idx) => (
        <div key={p.id} className="space-y-2 rounded-xl border border-border/60 bg-muted/15 p-3">
          <Label className="text-xs">Heading</Label>
          <Input
            value={p.title}
            onChange={(e) =>
              onChange({
                ...block,
                panels: block.panels.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
              })
            }
          />
          <ProposalRichText
            html={p.html ?? (p.body ? `<p>${escapeHtml(p.body)}</p>` : "<p></p>")}
            onChange={(html) =>
              onChange({
                ...block,
                panels: block.panels.map((x, i) => (i === idx ? { ...x, html, body: undefined } : x)),
              })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() =>
              onChange({
                ...block,
                panels: block.panels.filter((x) => x.id !== p.id),
              })
            }
          >
            Remove panel
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            ...block,
            panels: [...(block.panels ?? []), { id: newId(), title: "New panel", html: "<p></p>" }],
          })
        }
      >
        Add panel
      </Button>
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

  function setChildren(nextChildren: ProposalContentBlock[]) {
    onChange({ ...block, children: nextChildren });
  }

  function updateChild(childId: string, next: ProposalContentBlock) {
    setChildren(children.map((c) => (c.id === childId ? next : c)));
  }

  function removeChild(childId: string) {
    setChildren(children.filter((c) => c.id !== childId));
    if (selectedBlockId === childId) onSelectBlock(null);
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

  const backdropOn = resolveSectionBackground(block.background).active;

  return (
    <ProposalSectionShell background={block.background} variant="editor">
      <div className="space-y-3">
        <div
          className={cn(
            "-mx-1 rounded-xl px-1 py-1",
            backdropOn
              ? "border border-white/28 bg-transparent/35 backdrop-blur-[1px] sm:bg-transparent/45"
              : "border border-dashed border-border/65 bg-muted/20 sm:bg-muted/[0.35]",
          )}
        >
        {children.length === 0 ? (
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
                const supportsStyle = child.type === "pricing" || child.type === "packages";
                return (
                  <React.Fragment key={child.id}>
                    <SortableShell
                      id={child.id}
                      selected={isSelected}
                      onSelect={() => onSelectBlock(child.id)}
                      toolbar={({ dragAttributes, dragListeners }) => (
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
                          style={supportsStyle ? getBlockStyle(child) : undefined}
                          onStyleChange={
                            supportsStyle ? (next) => applyBlockStyle(child.id, next) : undefined
                          }
                          trailingSlot={
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
                          }
                        />
                      )}
                    >
                      <BlockFields
                        block={child}
                        onChange={(next) => updateChild(child.id, next as ProposalContentBlock)}
                        getBlockStyle={getBlockStyle}
                        applyBlockStyle={applyBlockStyle}
                      />
                    </SortableShell>
                    <InsertBlockSlot context="section" variant="between" onAdd={(b) => addChildAt(b, idx + 1)} />
                  </React.Fragment>
                );
              })}
            </SortableContext>
          </DndContext>
        )}
        {children.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-2 pb-8 pt-4 text-center text-xs text-muted-foreground">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-muted px-1.5 font-semibold text-foreground ring-1 ring-border">
              +
            </span>
            <span>
              Add content · use the luminous (+) row markers or browse the&nbsp;
              <SectionInsertMenu
                align="center"
                onAdd={(b) => addChildAt(b, children.length)}
                trigger={
                  <button
                    type="button"
                    className="font-semibold underline decoration-muted-foreground/80 underline-offset-2 hover:text-foreground"
                  >
                    Browse Content gallery
                  </button>
                }
              />
            </span>
          </div>
        ) : null}
      </div>
      <SectionInsertMenu
        onAdd={(b) => addChildAt(b, children.length)}
        trigger={
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" aria-hidden /> Insert from gallery
            <ChevronDown className="h-4 w-4 opacity-75" aria-hidden />
          </Button>
        }
      />
    </div>
    </ProposalSectionShell>
  );
}

function BlockFields({
  block,
  onChange,
  selection,
  getBlockStyle,
  applyBlockStyle,
}: {
  block: ProposalBlock;
  onChange: (next: ProposalBlock) => void;
  selection?: { selectedId: string | null; onSelect: (id: string | null) => void };
  getBlockStyle?: (b: ProposalBlock) => BlockStyle | undefined;
  applyBlockStyle?: (id: string, style: BlockStyle | undefined) => void;
}) {
  const patch = (next: ProposalBlock) => onChange(next);

  switch (block.type) {
    case "section": {
      const b = block as SectionBlock;
      return (
        <SectionBlockFields
          block={b}
          onChange={patch}
          selectedBlockId={selection?.selectedId ?? null}
          onSelectBlock={selection?.onSelect ?? (() => {})}
          getBlockStyle={getBlockStyle ?? (() => undefined)}
          applyBlockStyle={applyBlockStyle ?? ((_sid: string, _style: BlockStyle | undefined) => {})}
        />
      );
    }
    case "header": {
      const b = block as HeaderBlock;
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`h-${b.id}`}>Heading text</Label>
            <Input
              id={`h-${b.id}`}
              value={b.text}
              onChange={(e) => patch({ ...b, text: e.target.value })}
            />
          </div>
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
      return <PackagesInlineEditor block={b} onChange={patch} />;
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
      return <ColumnsBlockFields block={col} onChange={(next) => patch(next)} />;
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

export interface ProposalDocumentEditorProps {
  variant?: "proposal" | "template";
  proposalId?: string;
  templateId?: string;
  initialTemplateName?: string;
  initialTemplateDescription?: string;
  initialTitle: string;
  initialDocument: ProposalDocument;
  initialStatus?: string;
}

export function ProposalDocumentEditor({
  variant = "proposal",
  proposalId,
  templateId,
  initialTemplateName = "",
  initialTemplateDescription = "",
  initialTitle,
  initialDocument,
  initialStatus = "draft",
}: ProposalDocumentEditorProps) {
  const isTemplate = variant === "template";
  const [templateName, setTemplateName] = React.useState(initialTemplateName);
  const [templateDescription, setTemplateDescription] = React.useState(initialTemplateDescription);
  const [title, setTitle] = React.useState(initialTitle);
  const [blocks, setBlocks] = React.useState<ProposalBlock[]>(initialDocument.blocks);
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const doc: ProposalDocument = React.useMemo(() => ({ title, blocks }), [title, blocks]);

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
        description: templateDescription.trim() || undefined,
        title,
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
      title,
      document: doc,
    });
    setSaving(false);
    setMessage(res.ok ? "Saved." : res.message);
  }

  async function send() {
    if (isTemplate || !proposalId) return;
    setSending(true);
    setMessage(null);
    const saved = await saveProposalDocumentAction({ proposalId, title, document: doc });
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
        if (c.type !== "pricing" && c.type !== "packages") return c;
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
        if (c.id === id && (c.type === "pricing" || c.type === "packages")) {
          changed = true;
          if (style === undefined) {
            const { style: _drop, ...rest } = c;
            void _drop;
            return rest as ProposalContentBlock;
          }
          return { ...c, style } as ProposalContentBlock;
        }
        if (c.type === "columns") {
          const nl = applyStyleToStacks(c.left);
          const nr = applyStyleToStacks(c.right);
          if (nl !== c.left || nr !== c.right) {
            changed = true;
            return { ...c, left: nl, right: nr };
          }
        }
        return c;
      });
      return changed ? next : null;
    }

    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          if (b.type === "pricing" || b.type === "packages" || b.type === "section") {
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
          return {
            ...b,
            left: applyStyleToStacks(b.left),
            right: applyStyleToStacks(b.right),
          };
        }
        return b;
      }),
    );
  }

  function getBlockStyle(block: ProposalBlock): BlockStyle | undefined {
    if (block.type === "pricing" || block.type === "packages" || block.type === "section") {
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
              <Link href="/admin/proposals">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                All templates
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link
                href={`/admin/proposals/templates/${templateId}/preview`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Open public viewer
              </Link>
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <DeleteProposalTemplateButton
                templateId={templateId}
                templateName={templateName.trim() || initialTemplateName || "Untitled template"}
              />
              <Button type="button" size="sm" disabled={saving} onClick={() => void save()} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
          </div>
          {message ? <span className="block text-sm text-muted-foreground">{message}</span> : null}
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
        </div>
      )}

      {isTemplate ? (
        <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/15 p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="tmpl-name">Template name</Label>
            <Input
              id="tmpl-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Enterprise SaaS"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tmpl-desc">Description (internal)</Label>
            <Textarea
              id="tmpl-desc"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="When to use this template…"
              rows={2}
              className="resize-y"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="proposal-title">{isTemplate ? "Default proposal title" : "Proposal title"}</Label>
        <Input id="proposal-title" value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xl" />
        {!isTemplate && initialStatus === "draft" ? (
          <p className="text-xs text-muted-foreground">
            Save &amp; publish sends the public link, records engagement, and moves a linked opportunity to the Proposal
            stage.
          </p>
        ) : null}
        {isTemplate ? (
          <p className="text-xs text-muted-foreground">
            Use merge tokens in titles or text: {"{{name}}"}, {"{{email}}"}, {"{{company}}"}, {"{{opportunity}}"},{" "}
            {"{{deal_amount}}"} when generating from a customer or deal.
          </p>
        ) : null}
      </div>

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
            <div onClick={() => setSelectedBlockId(null)}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <InsertBlockSlot onAdd={(b) => addBlockAt(b, 0)} />
                  {blocks.map((block, idx) => {
                    const isSelected = selectedBlockId === block.id;
                    const supportsStyle =
                      block.type === "pricing" || block.type === "packages" || block.type === "section";
                    return (
                      <React.Fragment key={block.id}>
                        <SortableShell
                          id={block.id}
                          selected={isSelected}
                          onSelect={() => setSelectedBlockId(block.id)}
                          toolbar={({ dragAttributes, dragListeners }) => (
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
                                ) : undefined
                              }
                              trailingSlot={
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
                              }
                            />
                          )}
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
                          />
                        </SortableShell>
                        <InsertBlockSlot onAdd={(b) => addBlockAt(b, idx + 1)} />
                      </React.Fragment>
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
          className="mt-4 rounded-2xl border border-border/70 bg-muted/15 py-6 md:py-10"
        >
          <div className={PROPOSAL_PUBLIC_CONTENT_CLASSES}>
            <ProposalDocumentView document={doc} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
