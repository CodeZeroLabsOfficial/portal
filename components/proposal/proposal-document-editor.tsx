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
  Coins,
  GripVertical,
  Heading,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  MonitorPlay,
  PenLine,
  Plus,
  Save,
  ScrollText,
  Send,
  SeparatorHorizontal,
  Sparkles,
  SquarePen,
  Trash2,
} from "lucide-react";
import type {
  FormBlock,
  FormField,
  HeaderBlock,
  ImageBlock,
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { escapeHtml } from "@/lib/escape-html";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  proposalId: string;
  initialTitle: string;
  initialDocument: ProposalDocument;
  initialStatus: string;
}

export function ProposalDocumentEditor({
  proposalId,
  initialTitle,
  initialDocument,
  initialStatus,
}: ProposalDocumentEditorProps) {
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
    const res = await saveProposalDocumentAction({
      proposalId,
      title,
      document: doc,
    });
    setSaving(false);
    setMessage(res.ok ? "Saved." : res.message);
  }

  async function send() {
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

  function addBlock(type: ProposalBlock["type"]) {
    setBlocks((prev) => [...prev, createBlock(type)]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={saving} onClick={() => void save()} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
        <Button type="button" variant="secondary" disabled={sending} onClick={() => void send()} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Save & publish
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Add block
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={() => addBlock("header")}>
              <Heading className="mr-2 h-4 w-4" /> Heading
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock("text")}>
              <ScrollText className="mr-2 h-4 w-4" /> Rich text
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock("image")}>
              <ImageIcon className="mr-2 h-4 w-4" /> Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock("video")}>
              <MonitorPlay className="mr-2 h-4 w-4" /> Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock("pricing")}>
              <Coins className="mr-2 h-4 w-4" /> Pricing table
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock("form")}>
              <SquarePen className="mr-2 h-4 w-4" /> Form
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock("signature")}>
              <PenLine className="mr-2 h-4 w-4" /> Signature / terms
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock("embed")}>
              <LayoutTemplate className="mr-2 h-4 w-4" /> Embed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock("payment")}>
              <Sparkles className="mr-2 h-4 w-4" /> Payment placeholder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock("divider")}>
              <SeparatorHorizontal className="mr-2 h-4 w-4" /> Divider
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-title">Proposal title</Label>
        <Input id="proposal-title" value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xl" />
        {initialStatus === "draft" ? (
          <p className="text-xs text-muted-foreground">
            Save &amp; publish sends the public link, records engagement, and moves a linked opportunity to the Proposal
            stage.
          </p>
        ) : null}
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit blocks</TabsTrigger>
          <TabsTrigger value="preview">Live preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="mt-4 space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map((block) => (
                <SortableShell key={block.id} id={block.id} label={blockLabel(block.type)}>
                  <BlockFields
                    block={block}
                    onChange={(next) => updateBlock(block.id, next)}
                    onRemove={() => removeBlock(block.id)}
                  />
                </SortableShell>
              ))}
            </SortableContext>
          </DndContext>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add blocks to build your proposal.</p>
          ) : null}
        </TabsContent>
        <TabsContent value="preview" className="mt-4 rounded-2xl border border-border/70 bg-muted/15 p-6 md:p-10">
          <ProposalDocumentView document={doc} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
