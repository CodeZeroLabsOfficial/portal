"use client";

import * as React from "react";
import { Check, ImageIcon, Layers, MonitorPlay } from "lucide-react";
import { STYLE_PRESET_COLORS } from "@/lib/block-style";
import {
  defaultSectionBackground,
  isSectionBackgroundActive,
  mergeSectionBackground,
  resolveSectionBackground,
} from "@/lib/section-background";
import { cn } from "@/lib/utils";
import type { SectionBackground, SectionBackdropKind } from "@/types/proposal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ProposalSectionBackgroundPickerProps {
  background?: SectionBackground;
  onChange: (next: SectionBackground | undefined) => void;
  elevated?: boolean;
}

export function ProposalSectionBackgroundPicker({
  background,
  onChange,
  elevated = false,
}: ProposalSectionBackgroundPickerProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const model = mergeSectionBackground(background, {});
  const resolvedPreview = resolveSectionBackground(model);
  const hasPersistedBackdrop = Boolean(background && isSectionBackgroundActive(background));

  function patch(part: Partial<SectionBackground>) {
    onChange(mergeSectionBackground(background, part));
  }

  function setKind(next: SectionBackdropKind) {
    const base = defaultSectionBackground();
    patch({
      kind: next,
      color: model.color ?? base.color,
      mediaUrl:
        next === "color"
          ? undefined
          : model.mediaUrl && model.kind !== "color"
            ? model.mediaUrl
            : "",
    });
  }

  const shell = elevated
    ? "border-zinc-700/60 bg-zinc-900/95 text-zinc-100 shadow-xl"
    : "border border-border bg-popover text-popover-foreground shadow-lg";
  const labelMuted = elevated ? "text-zinc-400" : "text-muted-foreground";

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Background"
          aria-label="Background"
          className={cn(
            "relative inline-flex h-8 w-8 items-center justify-center rounded-full ring-2 transition-colors focus:outline-none focus-visible:ring-2",
            elevated
              ? "text-zinc-200 hover:bg-white/10 focus-visible:ring-white/35 data-[state=open]:bg-white/15"
              : "text-muted-foreground ring-offset-2 ring-offset-muted/90 hover:bg-background hover:text-foreground focus-visible:ring-ring data-[state=open]:bg-background data-[state=open]:shadow-sm dark:ring-offset-zinc-800",
            hasPersistedBackdrop ? "" : elevated ? "ring-white/35" : "ring-border ring-dashed",
          )}
        >
          <Layers className={cn("h-4 w-4", elevated && !hasPersistedBackdrop && "opacity-90")} />
          <PreviewSwatchMini model={model} elevated={elevated} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={8}
        className={cn("w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-xl p-0", shell)}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b px-4 py-3">
          <p className={cn("text-[10px] font-semibold uppercase tracking-[0.22em]", labelMuted)}>Background type</p>
          <Tabs
            value={model.kind}
            onValueChange={(v) => setKind(v as SectionBackdropKind)}
            className="mt-3"
          >
            <TabsList
              className={cn(
                "grid h-10 w-full grid-cols-3 gap-1 rounded-lg p-1",
                elevated ? "bg-black/70" : "bg-muted",
              )}
            >
              <TabsTrigger
                value="color"
                className={cn(
                  "gap-1.5 px-2 text-xs font-semibold",
                  elevated && "text-zinc-300 data-[state=active]:bg-zinc-600 data-[state=active]:text-white",
                )}
              >
                Color
              </TabsTrigger>
              <TabsTrigger
                value="image"
                className={cn(
                  "gap-1.5 px-2 text-xs font-semibold",
                  elevated && "text-zinc-300 data-[state=active]:bg-zinc-600 data-[state=active]:text-white",
                )}
              >
                Image
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className={cn(
                  "gap-1.5 px-2 text-xs font-semibold",
                  elevated && "text-zinc-300 data-[state=active]:bg-zinc-600 data-[state=active]:text-white",
                )}
              >
                Video
              </TabsTrigger>
            </TabsList>
            <TabsContent value="color" className="mt-3 space-y-2 outline-none">
              <TintSwatchPicker
                elevated={elevated}
                label="Backdrop color"
                value={normalizeHex(model.color) ?? "#0f172a"}
                onChange={(c) => patch({ kind: "color", color: c, mediaUrl: undefined })}
              />
            </TabsContent>
            <TabsContent value="image" className="mt-3 space-y-2 outline-none">
              <MiniAssetRow elevated={elevated} kind="image" url={model.mediaUrl} />
              <div className="space-y-1.5 pt-2">
                <Label className={cn("text-[11px] font-semibold uppercase tracking-wide", labelMuted)}>
                  Image URL
                </Label>
                <Input
                  value={model.mediaUrl ?? ""}
                  onChange={(e) => patch({ kind: "image", mediaUrl: e.target.value })}
                  placeholder="https://…"
                  className={elevated ? "border-zinc-700 bg-zinc-900 text-zinc-100" : ""}
                  spellCheck={false}
                />
              </div>
            </TabsContent>
            <TabsContent value="video" className="mt-3 space-y-2 outline-none">
              <MiniAssetRow elevated={elevated} kind="video" url={model.mediaUrl} />
              <div className="space-y-1.5 pt-2">
                <Label className={cn("text-[11px] font-semibold uppercase tracking-wide", labelMuted)}>
                  Video URL (.mp4, WebM, etc.)
                </Label>
                <Input
                  value={model.mediaUrl ?? ""}
                  onChange={(e) => patch({ kind: "video", mediaUrl: e.target.value })}
                  placeholder="https://…"
                  className={elevated ? "border-zinc-700 bg-zinc-900 text-zinc-100" : ""}
                  spellCheck={false}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <p className={cn("mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]", labelMuted)}>
              Tint &amp; matte
            </p>
            <TintSwatchPicker
              elevated={elevated}
              label="Tint"
              value={normalizeHex(model.tintColor) ?? "#000000"}
              onChange={(c) => patch({ tintColor: c })}
            />

            <p className={cn("mb-2 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wider", labelMuted)}>
              Tint style
            </p>
            <div
              className={cn(
                "inline-flex h-9 w-full rounded-lg p-0.5 ring-1 ring-inset",
                elevated ? "bg-zinc-800/85 ring-white/15" : "bg-muted ring-border",
              )}
            >
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md text-xs font-medium transition-colors",
                  model.tintStyle !== "blend"
                    ? elevated
                      ? "bg-zinc-600 text-white"
                      : "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : elevated
                      ? "text-zinc-400 hover:text-zinc-200"
                      : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={model.tintStyle !== "blend"}
                onClick={() => patch({ tintStyle: "normal" })}
              >
                Normal
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md text-xs font-medium transition-colors",
                  model.tintStyle === "blend"
                    ? elevated
                      ? "bg-zinc-600 text-white"
                      : "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : elevated
                      ? "text-zinc-400 hover:text-zinc-200"
                      : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={model.tintStyle === "blend"}
                onClick={() => patch({ tintStyle: "blend" })}
              >
                Blend
              </button>
            </div>
          </div>

          <RangeRow
            elevated={elevated}
            label="Tint opacity"
            value={model.tintOpacity ?? 16}
            min={0}
            max={100}
            suffix=""
            format={(n) => String(Math.round(n))}
            onChange={(v) => patch({ tintOpacity: Math.round(v) })}
          />
          <RangeRow
            elevated={elevated}
            label="Background blur"
            value={model.blurStrength ?? 0}
            min={0}
            max={24}
            suffix=" px"
            format={(n) => String(Math.round(n))}
            onChange={(v) => patch({ blurStrength: Math.round(v) })}
          />

          <div className={cn("-mx-px flex flex-wrap gap-2 pt-1", elevated ? "border-t border-white/10" : "border-t border-border/70")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("flex-1 text-xs", elevated ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "")}
              onClick={() => onChange(undefined)}
              disabled={!background}
            >
              Clear background
            </Button>
          </div>
          <p className={cn("-mt-1 text-[11px]", labelMuted)}>
            {resolvedPreview.active ? "Shown on preview and shared pages immediately after save." : "Add colour, imagery, or subtle motion — then tighten with tint opacity and blur."}
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PreviewSwatchMini({ model, elevated }: { model: SectionBackground; elevated?: boolean }) {
  const preview = resolveSectionBackground(model);
  const ringFg = elevated ? "ring-black/85" : "ring-background";

  let inner: React.ReactNode;
  if (preview.kind === "color" || !preview.active) {
    inner = (
      <span
        className="absolute bottom-1 right-1 h-4 w-4 rounded-full shadow-sm ring-[1.5px]"
        style={{ backgroundColor: preview.colorHex, boxShadow: "inset 0 1px rgba(255,255,255,0.12)" }}
      />
    );
  } else if (preview.kind === "image") {
    inner =
      preview.mediaUrl && preview.active ? (
        <span
          className="absolute bottom-1 right-1 h-4 w-4 overflow-hidden rounded-full ring-[1.5px]"
          style={{
            borderColor: elevated ? "#27272a" : "var(--border)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary author URLs */}
          <img src={preview.mediaUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        </span>
      ) : (
        <span className={cn("absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted ring-[1.5px]", ringFg)}>
          <ImageIcon className="h-2.5 w-2.5 text-muted-foreground" />
        </span>
      );
  } else {
    inner =
      preview.mediaUrl && preview.active ? (
        <video
          className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 rounded-full object-cover ring-[1.5px] ring-neutral-950/80"
          muted
          playsInline
          preload="metadata"
          src={preview.mediaUrl}
        />
      ) : (
        <span className={cn("absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted ring-[1.5px]", ringFg)}>
          <MonitorPlay className="h-2.5 w-2.5 text-muted-foreground" />
        </span>
      );
  }

  return <span className="pointer-events-none absolute inset-0">{inner}</span>;
}

function MiniAssetRow({
  elevated,
  kind,
  url,
}: {
  elevated?: boolean;
  kind: "image" | "video";
  url?: string;
  label?: string;
}) {
  const labelMuted = elevated ? "text-zinc-400" : "text-muted-foreground";
  const trimmed = (url ?? "").trim();
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-border/70 dark:ring-white/15">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-muted/40 shadow-inner ring-2 ring-muted/40">
        {kind === "image" ? (
          trimmed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={trimmed} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <ImageIcon className={cn("h-5 w-5", labelMuted)} />
          )
        ) : trimmed ? (
          <video muted playsInline preload="metadata" className="h-full w-full object-cover opacity-95" src={trimmed} />
        ) : (
          <MonitorPlay className={cn("h-5 w-5", labelMuted)} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-foreground">
          Background {kind === "image" ? "image" : "video"}
        </p>
        <p className={cn("truncate text-[11px]", labelMuted)}>
          {trimmed || "Paste a HTTPS URL"}
        </p>
      </div>
    </div>
  );
}

function TintSwatchPicker({
  elevated,
  label,
  value,
  onChange,
}: {
  elevated?: boolean;
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const labelMuted = elevated ? "text-zinc-400" : "text-muted-foreground";
  const ringActive = elevated ? "ring-offset-zinc-900" : "ring-offset-background";
  const swatchIdle = elevated ? "border-zinc-700 hover:scale-105" : "border-border hover:scale-105";

  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  function commitDraft() {
    const n = normalizeHex(draft.trim());
    if (n) onChange(n);
    else setDraft(value);
  }

  return (
    <div>
      <p className={cn("mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider", labelMuted)}>{label}</p>
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
                isActive ? cn("ring-2 ring-ring ring-offset-2", ringActive) : swatchIdle,
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
      <div
        className={cn(
          "mt-2 flex items-center gap-2 rounded-lg border px-2 py-1.5",
          elevated ? "border-zinc-700/70 bg-black/55" : "border-border bg-muted/40",
        )}
      >
        <span className={cn("h-6 w-6 shrink-0 rounded-full ring-1", elevated ? "ring-zinc-700" : "ring-border")} style={{ backgroundColor: value }} />
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitDraft()}
          spellCheck={false}
          aria-label={`${label} hex`}
          className={elevated ? "h-8 border-transparent bg-transparent text-zinc-100" : "h-8 border-transparent bg-transparent"}
          placeholder="#0F172A"
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

function RangeRow({
  elevated,
  label,
  value,
  min,
  max,
  suffix,
  format,
  onChange,
}: {
  elevated?: boolean;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  const labelMuted = elevated ? "text-zinc-400" : "text-muted-foreground";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-4">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", labelMuted)}>{label}</p>
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
        className={cn(
          "h-2 w-full cursor-pointer accent-primary hover:accent-primary",
          elevated && "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:rounded-full",
        )}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

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
  const na = normalizeHex(a);
  const nb = normalizeHex(b);
  return !!na && na === nb;
}

function needsLightFg(hex: string): boolean {
  const n = normalizeHex(hex);
  if (!n) return false;
  return n !== "#ffffff" && n !== "#e2e8f0";
}
