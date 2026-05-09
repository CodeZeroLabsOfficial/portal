"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
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
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  GripVertical,
  Heading,
  Image as ImageIcon,
  LayoutTemplate,
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
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type {
  FormBlock,
  FormField,
  HeaderBlock,
  ImageBlock,
  PackagesBlock,
  PricingBlock,
  ProposalBlock,
  ProposalDocument,
  SignatureBlock,
  TextBlock,
  VideoBlock,
} from "@/types/proposal";
import { ProposalRichText } from "@/components/proposal/proposal-rich-text";
import { ProposalDocumentView } from "@/components/proposal/proposal-document-view";
import { saveProposalDocumentAction, sendProposalAction } from "@/server/actions/proposal-builder";
import { saveProposalTemplateAction } from "@/server/actions/proposal-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { escapeHtml } from "@/lib/escape-html";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface BlockOption {
  type: ProposalBlock["type"];
  label: string;
  icon: LucideIcon;
  /** Tailwind text color class for the tile icon. */
  accent: string;
  /** Tailwind background tint paired with the accent (used on the icon chip). */
  accentBg: string;
}

/** Six most-used blocks shown as the primary tile grid in the insert popover. */
const PRIMARY_BLOCK_OPTIONS: BlockOption[] = [
  { type: "text", label: "Text", icon: ScrollText, accent: "text-violet-500", accentBg: "bg-violet-500/10" },
  { type: "header", label: "Heading", icon: Heading, accent: "text-sky-500", accentBg: "bg-sky-500/10" },
  { type: "pricing", label: "Quote", icon: Coins, accent: "text-emerald-500", accentBg: "bg-emerald-500/10" },
  { type: "packages", label: "Plans", icon: Package, accent: "text-amber-500", accentBg: "bg-amber-500/10" },
  { type: "video", label: "Video", icon: MonitorPlay, accent: "text-rose-500", accentBg: "bg-rose-500/10" },
  { type: "signature", label: "Accept", icon: PenLine, accent: "text-cyan-500", accentBg: "bg-cyan-500/10" },
];

/** Secondary options revealed via "Add block from library". */
const LIBRARY_BLOCK_OPTIONS: BlockOption[] = [
  { type: "image", label: "Image", icon: ImageIcon, accent: "text-fuchsia-500", accentBg: "bg-fuchsia-500/10" },
  { type: "form", label: "Form", icon: SquarePen, accent: "text-indigo-500", accentBg: "bg-indigo-500/10" },
  { type: "embed", label: "Embed", icon: LayoutTemplate, accent: "text-teal-500", accentBg: "bg-teal-500/10" },
  { type: "payment", label: "Payment", icon: CreditCard, accent: "text-orange-500", accentBg: "bg-orange-500/10" },
  { type: "divider", label: "Divider", icon: SeparatorHorizontal, accent: "text-slate-400", accentBg: "bg-slate-500/10" },
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
    default:
      return { id, type: "text", html: "<p></p>" };
  }
}

function SortableShell({
  id,
  children,
  label,
}: {
  id: string;
  children: React.ReactNode;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("border-border/70 bg-card/80 shadow-sm", isDragging && "opacity-60 ring-2 ring-primary/30")}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
          <button
            type="button"
            className="touch-none rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Reorder ${label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function BlockFields({
  block,
  onChange,
  onRemove,
}: {
  block: ProposalBlock;
  onChange: (next: ProposalBlock) => void;
  onRemove: () => void;
}) {
  const patch = (next: ProposalBlock) => onChange(next);

  switch (block.type) {
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
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove block
          </Button>
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
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove block
          </Button>
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
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove block
          </Button>
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
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove block
          </Button>
        </div>
      );
    }
    case "pricing": {
      const b = block as PricingBlock;
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Section title</Label>
              <Input value={b.title ?? ""} onChange={(e) => patch({ ...b, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency (ISO)</Label>
              <Input
                value={b.currency}
                onChange={(e) => patch({ ...b, currency: e.target.value.toLowerCase().slice(0, 3) })}
                maxLength={3}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={b.allowQuantityEdit !== false}
              onChange={(e) => patch({ ...b, allowQuantityEdit: e.target.checked })}
            />
            Allow quantity editing on public link
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items (amounts in major units for editing)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  patch({
                    ...b,
                    lineItems: [
                      ...b.lineItems,
                      { id: newId(), label: "Line item", unitAmountMinor: 0, quantity: 1 },
                    ],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add line
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              {b.lineItems.map((li, idx) => (
                <div key={li.id} className="flex flex-wrap items-end gap-2 rounded-md bg-muted/20 p-2">
                  <Input
                    className="min-w-[140px] flex-1"
                    value={li.label}
                    onChange={(e) => {
                      const next = [...b.lineItems];
                      next[idx] = { ...li, label: e.target.value };
                      patch({ ...b, lineItems: next });
                    }}
                    placeholder="Label"
                  />
                  <Input
                    className="w-28"
                    type="number"
                    min={0}
                    step="0.01"
                    value={li.unitAmountMinor / 100}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      const next = [...b.lineItems];
                      next[idx] = { ...li, unitAmountMinor: Math.round(v * 100) };
                      patch({ ...b, lineItems: next });
                    }}
                    placeholder="Price"
                  />
                  <Input
                    className="w-20"
                    type="number"
                    min={1}
                    step={1}
                    value={li.quantity ?? 1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v) || v < 1) return;
                      const next = [...b.lineItems];
                      next[idx] = { ...li, quantity: Math.floor(v) };
                      patch({ ...b, lineItems: next });
                    }}
                    placeholder="Qty"
                  />
                  <label className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(li.optional)}
                      onChange={(e) => {
                        const next = [...b.lineItems];
                        next[idx] = { ...li, optional: e.target.checked };
                        patch({ ...b, lineItems: next });
                      }}
                    />
                    Add-on
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove line"
                    onClick={() =>
                      patch({
                        ...b,
                        lineItems: b.lineItems.filter((x) => x.id !== li.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove block
          </Button>
        </div>
      );
    }
    case "packages": {
      const b = block as PackagesBlock;
      const tiers = b.tiers ?? [];
      return (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Section title</Label>
              <Input value={b.title ?? ""} onChange={(e) => patch({ ...b, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency (ISO)</Label>
              <Input
                value={b.currency}
                onChange={(e) => patch({ ...b, currency: e.target.value.toLowerCase().slice(0, 3) })}
                maxLength={3}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>12-month toggle label</Label>
              <Input value={b.plan12Label ?? ""} onChange={(e) => patch({ ...b, plan12Label: e.target.value })} placeholder="12 months" />
            </div>
            <div className="space-y-1.5">
              <Label>24-month toggle label</Label>
              <Input value={b.plan24Label ?? ""} onChange={(e) => patch({ ...b, plan24Label: e.target.value })} placeholder="24 months" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label className="text-base">Tiers</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() =>
                patch({
                  ...b,
                  tiers: [
                    ...tiers,
                    {
                      id: newId(),
                      name: "New tier",
                      includedUsers: 0,
                      includedLocations: 0,
                      includedAdmins: 0,
                      monthlyCost12Minor: 0,
                      monthlyCost24Minor: 0,
                      features: [],
                    },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add tier
            </Button>
          </div>

          <div className="space-y-6">
            {tiers.map((tier, idx) => (
              <div key={tier.id} className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Input
                    className="max-w-xs font-medium"
                    value={tier.name}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...tier, name: e.target.value };
                      patch({ ...b, tiers: next });
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(tier.recommended)}
                      onChange={(e) => {
                        const next = tiers.map((t, i) => ({
                          ...t,
                          recommended: i === idx ? e.target.checked : e.target.checked ? false : t.recommended,
                        }));
                        patch({ ...b, tiers: next });
                      }}
                    />
                    Recommended
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Included users</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={tier.includedUsers ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v) || v < 0) return;
                        const next = [...tiers];
                        next[idx] = { ...tier, includedUsers: Math.floor(v) };
                        patch({ ...b, tiers: next });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Included locations</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={tier.includedLocations ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v) || v < 0) return;
                        const next = [...tiers];
                        next[idx] = { ...tier, includedLocations: Math.floor(v) };
                        patch({ ...b, tiers: next });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Included admins</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={tier.includedAdmins ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v) || v < 0) return;
                        const next = [...tiers];
                        next[idx] = { ...tier, includedAdmins: Math.floor(v) };
                        patch({ ...b, tiers: next });
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Monthly cost — 12-month term</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={(tier.monthlyCost12Minor ?? 0) / 100}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        const next = [...tiers];
                        next[idx] = { ...tier, monthlyCost12Minor: Math.round(v * 100) };
                        patch({ ...b, tiers: next });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Monthly cost — 24-month term</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={(tier.monthlyCost24Minor ?? 0) / 100}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        const next = [...tiers];
                        next[idx] = { ...tier, monthlyCost24Minor: Math.round(v * 100) };
                        patch({ ...b, tiers: next });
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Upfront cost (12-month term only)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={(tier.upfrontCost12Minor ?? 0) / 100}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      const next = [...tiers];
                      next[idx] = {
                        ...tier,
                        upfrontCost12Minor: v > 0 ? Math.round(v * 100) : undefined,
                      };
                      patch({ ...b, tiers: next });
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">Leave at 0 for no upfront charge on the 12-month plan.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Features (one per line)</Label>
                  <textarea
                    className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={(tier.features ?? []).join("\n")}
                    onChange={(e) => {
                      const lines = e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const next = [...tiers];
                      next[idx] = { ...tier, features: lines };
                      patch({ ...b, tiers: next });
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => patch({ ...b, tiers: tiers.filter((t) => t.id !== tier.id) })}
                >
                  Remove tier
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove packages block
          </Button>
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
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove block
          </Button>
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
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove block
          </Button>
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
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove block
          </Button>
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
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove block
          </Button>
        </div>
      );
    case "divider":
      return (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Horizontal rule — visible on the public page.</p>
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove
          </Button>
        </div>
      );
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
  onAdd: (type: ProposalBlock["type"]) => void;
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

  function handlePick(type: ProposalBlock["type"]) {
    onAdd(type);
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className="w-[320px] p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {view === "main" ? (
          <div className="p-3">
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Add a block
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PRIMARY_BLOCK_OPTIONS.map((opt) => (
                <BlockTile key={opt.type} option={opt} onSelect={() => handlePick(opt.type)} />
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
                <LibraryRow key={opt.type} option={opt} onSelect={() => handlePick(opt.type)} />
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
}: {
  onAdd: (type: ProposalBlock["type"]) => void;
  variant?: "between" | "empty";
}) {
  if (variant === "empty") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">Start building your proposal</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Add a Text, Heading, Quote, Plans, Video or Accept block to get started.
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
  return (
    <div className="group/insert relative flex items-center justify-center py-1.5">
      <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-border opacity-0 transition-opacity group-hover/insert:opacity-100 group-focus-within/insert:opacity-100" />
      <AddBlockMenu
        onAdd={onAdd}
        trigger={
          <button
            type="button"
            aria-label="Add block here"
            className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary data-[state=open]:bg-primary data-[state=open]:text-primary-foreground data-[state=open]:opacity-100 group-hover/insert:opacity-100"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        }
      />
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

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function addBlockAt(type: ProposalBlock["type"], index: number) {
    setBlocks((prev) => {
      const next = [...prev];
      const safeIndex = Math.max(0, Math.min(index, next.length));
      next.splice(safeIndex, 0, createBlock(type));
      return next;
    });
  }

  return (
    <div className="space-y-6">
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
          {blocks.length === 0 ? (
            <InsertBlockSlot variant="empty" onAdd={(type) => addBlockAt(type, 0)} />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <InsertBlockSlot onAdd={(type) => addBlockAt(type, 0)} />
                {blocks.map((block, idx) => (
                  <React.Fragment key={block.id}>
                    <SortableShell id={block.id} label={blockLabel(block.type)}>
                      <BlockFields
                        block={block}
                        onChange={(next) => updateBlock(block.id, next)}
                        onRemove={() => removeBlock(block.id)}
                      />
                    </SortableShell>
                    <InsertBlockSlot onAdd={(type) => addBlockAt(type, idx + 1)} />
                  </React.Fragment>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </TabsContent>
        <TabsContent value="preview" className="mt-4 rounded-2xl border border-border/70 bg-muted/15 p-6 md:p-10">
          <ProposalDocumentView document={doc} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
