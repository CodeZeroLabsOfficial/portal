"use client";

import * as React from "react";
import { Check, ImageIcon, MonitorPlay, Paintbrush } from "lucide-react";
import { STYLE_PRESET_COLORS } from "@/lib/block-style";
import { cn } from "@/lib/utils";
import type { SplashBlock, SplashBlockBackground } from "@/types/proposal";
import { mergeSplashBackground, resolveSplashBackdrop } from "@/lib/splash-block";
import { ProposalRichText } from "@/components/proposal/proposal-rich-text";
import { ProposalSplashBlockCanvas } from "@/components/proposal/proposal-splash-block";
import { escapeHtml } from "@/lib/escape-html";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function normalizeHex(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    const [r, g, b] = v.split("") as string[];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return undefined;
}

function sameHex(a: string, b: string): boolean {
  return normalizeHex(a) === normalizeHex(b);
}

function needsLightFg(hex: string): boolean {
  const n = normalizeHex(hex);
  if (!n) return false;
  return n !== "#ffffff" && n !== "#e2e8f0";
}

function RangeRow({
  label,
  value,
  min,
  max,
  suffix,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="tabular-nums text-xs font-semibold tracking-tight text-foreground">
          {format(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={label}
        className="h-2 w-full cursor-pointer accent-primary"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function TintSwatchPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  function commitDraft() {
    const n = normalizeHex(draft.trim());
    if (n) onChange(n);
    else setDraft(value);
  }

  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="grid grid-cols-6 gap-2">
        {STYLE_PRESET_COLORS.map((c) => {
          const isActive = sameHex(c.value, value);
          return (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              title={c.label}
              className={cn(
                "relative h-8 w-8 rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "border-border hover:scale-105",
              )}
              style={{ backgroundColor: c.value }}
              onClick={() => onChange(c.value)}
            >
              {isActive ? (
                <Check
                  className={cn(
                    "absolute inset-0 m-auto h-4 w-4",
                    needsLightFg(c.value) ? "text-white" : "text-zinc-900",
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1.5">
        <span className="h-6 w-6 shrink-0 rounded-full ring-1 ring-border" style={{ backgroundColor: value }} />
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitDraft()}
          spellCheck={false}
          aria-label={`${label} hex`}
          className="h-8 border-transparent bg-transparent"
          placeholder="#000000"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>
    </div>
  );
}

function FocalPointGrid({
  value,
  onChange,
}: {
  value: { x: number; y: number };
  onChange: (next: { x: number; y: number }) => void;
}) {
  const pts = [0, 50, 100] as const;
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Focal point</p>
      <div className="grid w-28 grid-cols-3 gap-1">
        {pts.flatMap((y) =>
          pts.map((x) => {
            const active = value.x === x && value.y === y;
            return (
              <button
                key={`${x}-${y}`}
                type="button"
                aria-label={`Focus ${x}% ${y}%`}
                className={cn(
                  "aspect-square rounded-md border text-[0] transition-colors",
                  active ? "border-primary bg-primary/20 ring-1 ring-primary" : "border-border bg-muted/40 hover:bg-muted",
                )}
                onClick={() => onChange({ x, y })}
              >
                <span className="sr-only">
                  {x}% {y}%
                </span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function patchBackground(block: SplashBlock, part: Partial<SplashBlockBackground>): SplashBlock {
  return {
    ...block,
    background: { ...mergeSplashBackground(block.background), ...part },
  };
}

export function ProposalSplashBackgroundPicker({
  block,
  onChange,
}: {
  block: SplashBlock;
  onChange: (next: SplashBlock) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const model = mergeSplashBackground(block.background);
  const resolved = resolveSplashBackdrop(model);

  function patchBg(part: Partial<SplashBlockBackground>) {
    onChange(patchBackground(block, part));
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Splash background"
          aria-label="Splash background"
          className={cn(
            "relative inline-flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-muted/90 transition-colors hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-background dark:ring-offset-zinc-800",
            resolved.kind !== "color" || model.color ? "ring-border" : "ring-border ring-dashed",
          )}
        >
          <Paintbrush className="h-4 w-4 text-muted-foreground" />
          <span className="pointer-events-none absolute inset-0">
            {resolved.kind === "image" && resolved.imageUrl ? (
              <span className="absolute bottom-1 right-1 h-4 w-4 overflow-hidden rounded-full ring-[1.5px] ring-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolved.imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              </span>
            ) : resolved.kind === "video" && resolved.videoUrl ? (
              <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-muted ring-[1.5px] ring-border">
                <MonitorPlay className="h-2.5 w-2.5 text-muted-foreground" />
              </span>
            ) : (
              <span
                className="absolute bottom-1 right-1 h-4 w-4 rounded-full ring-[1.5px] ring-border"
                style={{ backgroundColor: resolved.colorHex }}
              />
            )}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={8}
        className="w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover p-0 shadow-lg"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Background</p>
          <Tabs
            value={model.type}
            onValueChange={(v) => {
              const t = v as SplashBlockBackground["type"];
              if (t === "color") patchBg({ type: "color", url: undefined, videoUrl: undefined });
              else if (t === "image") patchBg({ type: "image", videoUrl: undefined });
              else patchBg({ type: "video" });
            }}
            className="mt-3"
          >
            <TabsList className="grid h-10 w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              <TabsTrigger value="color" className="px-2 text-xs font-semibold">
                Color
              </TabsTrigger>
              <TabsTrigger value="image" className="px-2 text-xs font-semibold">
                Image
              </TabsTrigger>
              <TabsTrigger value="video" className="px-2 text-xs font-semibold">
                Video
              </TabsTrigger>
            </TabsList>
            <TabsContent value="color" className="mt-3 space-y-2 outline-none">
              <TintSwatchPicker
                label="Fill"
                value={normalizeHex(model.color) ?? "#0f172a"}
                onChange={(c) => patchBg({ type: "color", color: c })}
              />
            </TabsContent>
            <TabsContent value="image" className="mt-3 space-y-2 outline-none">
              <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/50">
                  {model.url?.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={model.url.trim()} alt="" className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Image URL</Label>
                  <Input
                    value={model.url ?? ""}
                    onChange={(e) => patchBg({ type: "image", url: e.target.value })}
                    placeholder="https://…"
                    spellCheck={false}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="video" className="mt-3 space-y-3 outline-none">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Video URL</Label>
                <Input
                  value={model.videoUrl ?? ""}
                  onChange={(e) => patchBg({ type: "video", videoUrl: e.target.value })}
                  placeholder="YouTube, Vimeo, or .mp4"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Poster (mobile)</Label>
                <Input
                  value={model.posterUrl ?? ""}
                  onChange={(e) => patchBg({ posterUrl: e.target.value })}
                  placeholder="Image URL · optional"
                  spellCheck={false}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-3 px-4 py-4">
          <TintSwatchPicker
            label="Tint colour"
            value={normalizeHex(model.tintColor) ?? "#000000"}
            onChange={(c) => patchBg({ tintColor: c })}
          />
          <div className="inline-flex h-9 w-full rounded-lg bg-muted p-0.5 ring-1 ring-inset ring-border">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md text-xs font-medium transition-colors",
                model.tintMode !== "blend" ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground",
              )}
              onClick={() => patchBg({ tintMode: "normal" })}
            >
              Normal
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md text-xs font-medium transition-colors",
                model.tintMode === "blend" ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground",
              )}
              onClick={() => patchBg({ tintMode: "blend" })}
            >
              Blend
            </button>
          </div>
          <RangeRow
            label="Tint opacity"
            value={model.tintOpacity ?? 35}
            min={0}
            max={100}
            suffix="%"
            format={(n) => String(Math.round(n))}
            onChange={(v) => patchBg({ tintOpacity: Math.round(v) })}
          />
          <RangeRow
            label="Blur"
            value={model.blur ?? 0}
            min={0}
            max={24}
            suffix=" px"
            format={(n) => String(Math.round(n))}
            onChange={(v) => patchBg({ blur: Math.round(v) })}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SplashBlockInspector({ block, onChange }: { block: SplashBlock; onChange: (next: SplashBlock) => void }) {
  const model = mergeSplashBackground(block.background);
  const fp = model.focalPoint ?? { x: 50, y: 50 };

  function patchBg(part: Partial<SplashBlockBackground>) {
    onChange(patchBackground(block, part));
  }

  const html = block.html ?? (block.body ? `<p>${escapeHtml(block.body)}</p>` : "<p></p>");

  return (
    <div className="space-y-4">
      <ProposalSplashBlockCanvas block={block} mode="editor">
        <ProposalRichText
          key={block.id}
          html={html}
          onChange={(nextHtml) => onChange({ ...block, html: nextHtml, body: undefined })}
          placeholder="Headline, supporting copy, logo…"
          className="border-white/25 bg-black/30 text-white [&_.ProseMirror]:min-h-[100px] [&_p]:text-white/90"
        />
      </ProposalSplashBlockCanvas>

      <Tabs defaultValue="background" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="background" className="text-xs">
            Background
          </TabsTrigger>
          <TabsTrigger value="layout" className="text-xs">
            Layout
          </TabsTrigger>
          <TabsTrigger value="content" className="text-xs">
            Content
          </TabsTrigger>
        </TabsList>
        <TabsContent value="background" className="mt-4 space-y-4 outline-none">
          <div>
            <Label className="text-xs text-muted-foreground">Background type</Label>
            <div className="mt-2 inline-flex h-10 w-full rounded-lg bg-muted p-1 ring-1 ring-inset ring-border">
              {(["color", "image", "video"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    "flex-1 rounded-md text-xs font-semibold capitalize transition-colors",
                    model.type === t ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    if (t === "color") patchBg({ type: "color" });
                    else if (t === "image") patchBg({ type: "image" });
                    else patchBg({ type: "video" });
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {model.type === "color" ? (
            <TintSwatchPicker
              label="Backdrop"
              value={normalizeHex(model.color) ?? "#0f172a"}
              onChange={(c) => patchBg({ type: "color", color: c })}
            />
          ) : null}
          {model.type === "image" ? (
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={model.url ?? ""}
                onChange={(e) => patchBg({ type: "image", url: e.target.value })}
                placeholder="https://…"
                spellCheck={false}
              />
            </div>
          ) : null}
          {model.type === "video" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Video URL</Label>
                <Input
                  value={model.videoUrl ?? ""}
                  onChange={(e) => patchBg({ type: "video", videoUrl: e.target.value })}
                  placeholder="YouTube, Vimeo, or direct file"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Poster image (mobile / fallback)</Label>
                <Input
                  value={model.posterUrl ?? ""}
                  onChange={(e) => patchBg({ posterUrl: e.target.value })}
                  placeholder="https://…"
                  spellCheck={false}
                />
              </div>
            </div>
          ) : null}
          <TintSwatchPicker
            label="Tint"
            value={normalizeHex(model.tintColor) ?? "#000000"}
            onChange={(c) => patchBg({ tintColor: c })}
          />
          <div className="flex gap-2 rounded-lg border border-border bg-muted/30 p-1">
            <Button
              type="button"
              size="sm"
              variant={model.tintMode !== "blend" ? "secondary" : "ghost"}
              className="flex-1 text-xs"
              onClick={() => patchBg({ tintMode: "normal" })}
            >
              Normal tint
            </Button>
            <Button
              type="button"
              size="sm"
              variant={model.tintMode === "blend" ? "secondary" : "ghost"}
              className="flex-1 text-xs"
              onClick={() => patchBg({ tintMode: "blend" })}
            >
              Blend
            </Button>
          </div>
          <RangeRow
            label="Tint opacity"
            value={model.tintOpacity ?? 35}
            min={0}
            max={100}
            suffix="%"
            format={(n) => String(Math.round(n))}
            onChange={(v) => patchBg({ tintOpacity: Math.round(v) })}
          />
          <RangeRow
            label="Background blur"
            value={model.blur ?? 0}
            min={0}
            max={24}
            suffix=" px"
            format={(n) => String(Math.round(n))}
            onChange={(v) => patchBg({ blur: Math.round(v) })}
          />
        </TabsContent>
        <TabsContent value="layout" className="mt-4 space-y-4 outline-none">
          <div className="space-y-2">
            <Label>Height</Label>
            <div className="flex flex-wrap gap-2">
              {(["full", "half", "third"] as const).map((h) => (
                <Button
                  key={h}
                  type="button"
                  size="sm"
                  variant={block.height === h ? "default" : "outline"}
                  className="text-xs capitalize"
                  onClick={() => onChange({ ...block, height: h })}
                >
                  {h === "full" ? "Full view" : h === "half" ? "50%" : "33%"}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Custom</Label>
                <Input
                  type="number"
                  min={120}
                  max={2400}
                  className="h-9 w-24"
                  value={typeof block.height === "object" ? block.height.custom : ""}
                  placeholder="px / vh"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n) || n <= 0) return;
                    onChange({
                      ...block,
                      height: { custom: Math.round(n), unit: typeof block.height === "object" ? block.height.unit : "px" },
                    });
                  }}
                />
              </div>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={typeof block.height === "object" ? block.height.unit : "px"}
                onChange={(e) => {
                  const unit = e.target.value as "px" | "vh";
                  const custom =
                    typeof block.height === "object" ? block.height.custom : 480;
                  onChange({ ...block, height: { custom, unit } });
                }}
              >
                <option value="px">px</option>
                <option value="vh">vh</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vertical align</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={block.alignment.vertical}
                onChange={(e) =>
                  onChange({
                    ...block,
                    alignment: {
                      ...block.alignment,
                      vertical: e.target.value as SplashBlock["alignment"]["vertical"],
                    },
                  })
                }
              >
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Horizontal align</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={block.alignment.horizontal}
                onChange={(e) =>
                  onChange({
                    ...block,
                    alignment: {
                      ...block.alignment,
                      horizontal: e.target.value as SplashBlock["alignment"]["horizontal"],
                    },
                  })
                }
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
          <FocalPointGrid value={fp} onChange={(next) => patchBg({ focalPoint: next })} />
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
            <span className="text-sm font-medium">Content card</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={Boolean(block.showCard)}
              onChange={(e) => onChange({ ...block, showCard: e.target.checked })}
            />
          </label>
          {block.showCard ? (
            <RangeRow
              label="Card strength"
              value={block.cardOpacity ?? 70}
              min={8}
              max={100}
              suffix="%"
              format={(n) => String(Math.round(n))}
              onChange={(v) => onChange({ ...block, cardOpacity: Math.round(v) })}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="content" className="mt-4 space-y-2 outline-none">
          <p className="text-sm text-muted-foreground">
            Edit text directly on the splash preview above. Use the bubble toolbar for headings, colour, and links. Add an
            inline image for a logo via the image button.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
