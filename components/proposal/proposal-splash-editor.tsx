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
import { Textarea } from "@/components/ui/textarea";
import { normalizeSplashVideoUrlInput } from "@/lib/splash-video-url";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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

const LAYOUT_PRESETS = [
  { id: "tl", label: "Top left", focal: { x: 0, y: 0 }, vertical: "top" as const, horizontal: "left" as const },
  { id: "tc", label: "Top center", focal: { x: 50, y: 0 }, vertical: "top", horizontal: "center" },
  { id: "tr", label: "Top right", focal: { x: 100, y: 0 }, vertical: "top", horizontal: "right" },
  { id: "ml", label: "Middle left", focal: { x: 0, y: 50 }, vertical: "center", horizontal: "left" },
  { id: "c", label: "Center", focal: { x: 50, y: 50 }, vertical: "center", horizontal: "center" },
  { id: "mr", label: "Middle right", focal: { x: 100, y: 50 }, vertical: "center", horizontal: "right" },
  { id: "bl", label: "Bottom left", focal: { x: 0, y: 100 }, vertical: "bottom", horizontal: "left" },
  { id: "bc", label: "Bottom center", focal: { x: 50, y: 100 }, vertical: "bottom", horizontal: "center" },
  { id: "br", label: "Bottom right", focal: { x: 100, y: 100 }, vertical: "bottom", horizontal: "right" },
] as const;

function matchLayoutPresetId(block: SplashBlock): string {
  const bg = mergeSplashBackground(block.background);
  const fp = bg.focalPoint ?? { x: 50, y: 50 };
  const { vertical, horizontal } = block.alignment;
  for (const p of LAYOUT_PRESETS) {
    if (p.focal.x === fp.x && p.focal.y === fp.y && p.vertical === vertical && p.horizontal === horizontal) {
      return p.id;
    }
  }
  return "custom";
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
  hexInputAriaLabel,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  hexInputAriaLabel?: string;
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
      {label ? (
        <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      ) : null}
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
          aria-label={hexInputAriaLabel ?? (label ? `${label} hex` : "Colour hex")}
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
    <div className="grid w-[7.25rem] grid-cols-3 gap-1">
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
  );
}

function patchBackground(block: SplashBlock, part: Partial<SplashBlockBackground>): SplashBlock {
  return {
    ...block,
    background: { ...mergeSplashBackground(block.background), ...part },
  };
}

function applyLayoutPreset(block: SplashBlock, presetId: string): SplashBlock {
  if (presetId === "custom") return block;
  const p = LAYOUT_PRESETS.find((x) => x.id === presetId);
  if (!p) return block;
  return {
    ...block,
    alignment: { vertical: p.vertical, horizontal: p.horizontal },
    background: {
      ...mergeSplashBackground(block.background),
      focalPoint: { x: p.focal.x, y: p.focal.y },
    },
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
  const [customLayoutOpen, setCustomLayoutOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) setCustomLayoutOpen(false);
  }, [open]);
  const model = mergeSplashBackground(block.background);
  const resolved = resolveSplashBackdrop(model);
  const fp = model.focalPoint ?? { x: 50, y: 50 };
  const presetId = matchLayoutPresetId(block);
  const showCustomLayout = customLayoutOpen || presetId === "custom";
  const positionSelectValue = customLayoutOpen ? "custom" : presetId;

  function patchBg(part: Partial<SplashBlockBackground>) {
    onChange(patchBackground(block, part));
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Background"
          aria-label="Background"
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
        align="start"
        sideOffset={8}
        className="w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-lg"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Tabs defaultValue="background" className="w-full">
          <TabsList className="mx-3 mt-2 grid h-9 w-[calc(100%-1.5rem)] grid-cols-2 gap-0 rounded-lg bg-muted p-0.5">
            <TabsTrigger value="background" className="text-xs font-semibold">
              Background
            </TabsTrigger>
            <TabsTrigger value="layout" className="text-xs font-semibold">
              Layout
            </TabsTrigger>
          </TabsList>
          <TabsContent value="background" className="mt-0 outline-none">
            <div className="max-h-[min(58vh,460px)] overflow-y-auto overflow-x-hidden">
          <div className="border-b border-border/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Background type</p>
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
                  label="Backdrop"
                  value={normalizeHex(model.color) ?? "#0f172a"}
                  onChange={(c) => patchBg({ type: "color", color: c })}
                />
              </TabsContent>
              <TabsContent value="image" className="mt-3 space-y-3 outline-none">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                  onClick={() => document.getElementById(`splash-img-url-${block.id}`)?.focus()}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-inner">
                    {model.url?.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={model.url.trim()} alt="" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">Background image</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {model.url?.trim() || "Paste a HTTPS URL"}
                    </span>
                  </span>
                </button>
                <Input
                  id={`splash-img-url-${block.id}`}
                  value={model.url ?? ""}
                  onChange={(e) => patchBg({ type: "image", url: e.target.value })}
                  placeholder="https://…"
                  spellCheck={false}
                  className="text-sm"
                />
              </TabsContent>
              <TabsContent value="video" className="mt-3 space-y-3 outline-none">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                  onClick={() => document.getElementById(`splash-video-url-${block.id}`)?.focus()}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-inner">
                    {model.videoUrl?.trim() ? (
                      <MonitorPlay className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <MonitorPlay className="h-5 w-5 text-muted-foreground/60" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">Background video</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {model.videoUrl?.trim() || "Watch URL, embed URL, iframe, or MP4"}
                    </span>
                  </span>
                </button>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Video URL or embed</Label>
                  <Textarea
                    id={`splash-video-url-${block.id}`}
                    rows={3}
                    value={model.videoUrl ?? ""}
                    onChange={(e) => patchBg({ type: "video", videoUrl: e.target.value })}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) return;
                      const n = normalizeSplashVideoUrlInput(raw);
                      if (n && n !== raw) patchBg({ type: "video", videoUrl: n });
                    }}
                    placeholder={
                      "https://youtube.com/watch?v=… or paste an iframe from YouTube / Vimeo · MP4/WebM direct URL"
                    }
                    spellCheck={false}
                    className="resize-y text-sm leading-snug"
                  />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Paste a normal link, an embed URL (with{" "}
                    <code className="rounded bg-muted px-0.5 text-[10px]">controls=0</code> if you like), or the full{" "}
                    <code className="rounded bg-muted px-0.5 text-[10px]">&lt;iframe&gt;</code> markup — we strip the{" "}
                    <code className="rounded bg-muted px-0.5 text-[10px]">src</code> on blur. Use the option below to hide
                    player chrome for YouTube/Vimeo.
                  </p>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
                      checked={model.videoHideControls !== false}
                      onChange={(e) => patchBg({ videoHideControls: e.target.checked })}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight text-foreground">
                        Hide playback controls
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        Default on — matches a chrome-free splash backdrop (YouTube{" "}
                        <code className="rounded bg-muted px-0.5 text-[10px]">controls=0</code>, Vimeo background mode).
                        Turn off to show the provider&apos;s controls (e.g. while testing).
                      </span>
                    </span>
                  </label>
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

          <div className="space-y-4 px-4 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5">
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 rounded-full border border-border bg-muted ring-1 ring-inset ring-black/5 dark:ring-white/10"
                style={{ backgroundColor: normalizeHex(model.tintColor) ?? "#000000" }}
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium leading-none text-foreground">Background tint</p>
                <TintSwatchPicker
                  label=""
                  hexInputAriaLabel="Tint colour hex"
                  value={normalizeHex(model.tintColor) ?? "#000000"}
                  onChange={(c) => patchBg({ tintColor: c })}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tint style</p>
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

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5">
              <span className="text-sm font-medium text-foreground">Background card</span>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
                checked={Boolean(block.showCard)}
                onChange={(e) => onChange({ ...block, showCard: e.target.checked })}
              />
            </label>
            {block.showCard ? (
              <RangeRow
                label="Card opacity"
                value={block.cardOpacity ?? 70}
                min={8}
                max={100}
                suffix="%"
                format={(n) => String(Math.round(n))}
                onChange={(v) => onChange({ ...block, cardOpacity: Math.round(v) })}
              />
            ) : null}
          </div>
            </div>
          </TabsContent>

          <TabsContent value="layout" className="mt-0 outline-none">
            <div className="max-h-[min(58vh,460px)] overflow-y-auto overflow-x-hidden px-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Position</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  value={positionSelectValue}
                  aria-label="Background and content position"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "custom") {
                      setCustomLayoutOpen(true);
                      return;
                    }
                    setCustomLayoutOpen(false);
                    onChange(applyLayoutPreset(block, v));
                  }}
                >
                  {LAYOUT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {showCustomLayout ? (
                  <div className="flex flex-wrap items-end gap-4 pt-2">
                    <FocalPointGrid value={fp} onChange={(next) => patchBg({ focalPoint: next })} />
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Vertical</Label>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
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
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Horizontal</Label>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
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
                  </div>
                ) : null}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">Height</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(["full", "half", "third"] as const).map((h) => (
                    <Button
                      key={h}
                      type="button"
                      size="sm"
                      variant={block.height === h ? "default" : "outline"}
                      className="h-8 min-w-[4.5rem] flex-1 px-2 text-xs"
                      onClick={() => onChange({ ...block, height: h })}
                    >
                      {h === "full" ? "Full" : h === "half" ? "50%" : "33%"}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Custom</Label>
                    <Input
                      type="number"
                      min={120}
                      max={2400}
                      className="h-9 w-[5.5rem]"
                      value={typeof block.height === "object" ? block.height.custom : ""}
                      placeholder="—"
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n) || n <= 0) return;
                        onChange({
                          ...block,
                          height: {
                            custom: Math.round(n),
                            unit: typeof block.height === "object" ? block.height.unit : "px",
                          },
                        });
                      }}
                    />
                  </div>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={typeof block.height === "object" ? block.height.unit : "px"}
                    onChange={(e) => {
                      const unit = e.target.value as "px" | "vh";
                      const custom = typeof block.height === "object" ? block.height.custom : 480;
                      onChange({ ...block, height: { custom, unit } });
                    }}
                  >
                    <option value="px">px</option>
                    <option value="vh">vh</option>
                  </select>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SplashBlockInspector({ block, onChange }: { block: SplashBlock; onChange: (next: SplashBlock) => void }) {
  const html = block.html ?? (block.body ? `<p>${escapeHtml(block.body)}</p>` : "<p></p>");

  return (
    <ProposalSplashBlockCanvas block={block} mode="editor">
      <ProposalRichText
        key={block.id}
        html={html}
        onChange={(nextHtml) => onChange({ ...block, html: nextHtml, body: undefined })}
        placeholder="Start typing…"
        className="border-white/25 bg-black/30 text-white [&_.ProseMirror]:min-h-[100px] [&_p]:text-white/90"
      />
    </ProposalSplashBlockCanvas>
  );
}
