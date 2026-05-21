"use client";

import * as React from "react";
import { Check, MonitorPlay, Paintbrush } from "lucide-react";
import { STYLE_PRESET_COLORS } from "@/lib/block-style";
import { cn } from "@/lib/utils";
import type { SplashBlock, SplashBlockBackground } from "@/types/proposal";
import { mergeSplashBackground, resolveSplashBackdrop, type ResolvedSplashBackdrop } from "@/lib/splash-block";
import {
  SPLASH_LOGO_SIZE_OPTIONS,
  applySplashLogoHorizontal,
  mapHeadlineLayoutPresetForLogo,
  resolveSplashLogoHorizontal,
  sanitizeSplashContentAlignmentForLogo,
  splashLogoReservesTopBand,
} from "@/lib/splash-branding";
import type { ProposalBranding } from "@/types/proposal";
import {
  useProposalBrandingOptional,
  useSplashBackgroundPickerBranding,
  useSplashCompanyLogoUrl,
} from "@/components/proposal/proposal-branding-context";
import { ProposalRichText } from "@/components/proposal/proposal-rich-text";
import { ProposalSplashBlockCanvas } from "@/components/proposal/proposal-splash-block";
import { escapeHtml } from "@/lib/escape-html";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProposalMediaLibraryOptional } from "@/components/proposal/proposal-media-library";
import { SplashBackgroundTintPopover } from "@/components/proposal/proposal-background-tint-popover";
import { youtubeThumbnailFromPageUrl } from "@/components/proposal/embed-video";

/** Section headings in the splash background / logo / layout toolbar. */
const SPLASH_TOOLBAR_SECTION_LABEL_CLASS =
  "text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

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
      <div className="mb-1 flex items-end justify-between gap-3">
        <p className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>{label}</p>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground underline decoration-muted-foreground/45 underline-offset-[3px]">
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
        className="h-1.5 w-full cursor-pointer accent-sky-500 hover:accent-sky-600"
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
        <p className={cn("mb-1.5", SPLASH_TOOLBAR_SECTION_LABEL_CLASS)}>{label}</p>
      ) : null}
      <div className="grid grid-cols-6 gap-1.5">
        {STYLE_PRESET_COLORS.map((c) => {
          const isActive = sameHex(c.value, value);
          return (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              title={c.label}
              className={cn(
                "relative h-7 w-7 rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isActive ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : "border-border hover:scale-105",
              )}
              style={{ backgroundColor: c.value }}
              onClick={() => onChange(c.value)}
            >
              {isActive ? (
                <Check
                  className={cn(
                    "absolute inset-0 m-auto h-3.5 w-3.5",
                    needsLightFg(c.value) ? "text-white" : "text-zinc-900",
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex h-8 items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-2 py-0">
        <span className="h-5 w-5 shrink-0 rounded-full ring-1 ring-border" style={{ backgroundColor: value }} />
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitDraft()}
          spellCheck={false}
          aria-label={hexInputAriaLabel ?? (label ? `${label} hex` : "Colour hex")}
          className="h-7 border-0 bg-transparent p-0 text-xs font-medium tabular-nums tracking-tight text-foreground"
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

function applyLayoutPreset(
  block: SplashBlock,
  presetId: string,
  logoUrl: string,
): SplashBlock {
  if (presetId === "custom") return block;
  const mappedId = mapHeadlineLayoutPresetForLogo(presetId, logoUrl, block);
  const p = LAYOUT_PRESETS.find((x) => x.id === mappedId);
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

function SplashHorizontalAlignButtons({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SplashBlock["alignment"]["horizontal"];
  onChange: (horizontal: SplashBlock["alignment"]["horizontal"]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>{label}</Label>
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            { id: "left" as const, label: "Left" },
            { id: "center" as const, label: "Center" },
            { id: "right" as const, label: "Right" },
          ] as const
        ).map((opt) => (
          <Button
            key={opt.id}
            type="button"
            size="sm"
            variant={value === opt.id ? "default" : "outline"}
            className="h-8 px-2 text-xs"
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SplashBackgroundTriggerMedia(model: SplashBlockBackground, resolved: ResolvedSplashBackdrop) {
  if (resolved.kind === "image" && resolved.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolved.imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
    );
  }
  if (resolved.kind === "video" && resolved.videoUrl) {
    const poster = model.posterUrl?.trim();
    if (poster) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="h-full w-full object-cover" draggable={false} />
      );
    }
    if (resolved.isDirectVideo) {
      return (
        <video
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          src={resolved.videoUrl}
          aria-hidden
        />
      );
    }
    const yt = youtubeThumbnailFromPageUrl(resolved.videoUrl);
    if (yt) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={yt} alt="" className="h-full w-full object-cover" draggable={false} />
      );
    }
    return <span className="block h-full w-full bg-muted" aria-hidden />;
  }
  return null;
}

function setBrandingLogoUrl(
  branding: ProposalBranding | undefined,
  url: string,
  onBrandingChange: (next: ProposalBranding | undefined) => void,
) {
  const trimmed = url.trim();
  if (!trimmed) {
    const next = { ...branding };
    delete next.logoUrl;
    const keys = Object.keys(next).filter(
      (k) => (next as ProposalBranding)[k as keyof ProposalBranding] != null,
    );
    onBrandingChange(keys.length > 0 ? next : undefined);
    return;
  }
  onBrandingChange({ ...branding, logoUrl: trimmed });
}

function SplashLogoSettingsPanel({
  block,
  onChange,
  onCloseMenu,
}: {
  block: SplashBlock;
  onChange: (next: SplashBlock) => void;
  onCloseMenu: () => void;
}) {
  const mediaLibrary = useProposalMediaLibraryOptional();
  const brandingCtx = useProposalBrandingOptional();
  const logoUrl = brandingCtx?.branding?.logoUrl?.trim() ?? "";
  const onBrandingChange = brandingCtx?.onBrandingChange;
  const canEditLogo = Boolean(onBrandingChange);
  const logoSize = block.logoSize ?? "md";

  return (
    <div className="max-h-[min(58vh,460px)] overflow-y-auto overflow-x-hidden px-4 py-4">
      <div className="space-y-1.5">
        <button
          type="button"
          disabled={!canEditLogo && !logoUrl}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ring-1 ring-border/50 transition-colors",
            canEditLogo && mediaLibrary && "cursor-pointer hover:bg-muted/35 hover:ring-border/70",
            !canEditLogo && "cursor-default bg-muted/10",
            !canEditLogo && !logoUrl && "opacity-60",
          )}
          onClick={() => {
            if (!canEditLogo || !mediaLibrary || !onBrandingChange) return;
            onCloseMenu();
            window.setTimeout(() => {
              mediaLibrary.openSelection({
                allowedKinds: ["image"],
                onSelect: (asset) => {
                  if (asset.kind !== "image") return;
                  setBrandingLogoUrl(brandingCtx?.branding, asset.downloadUrl, onBrandingChange);
                },
              });
            }, 0);
          }}
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/20">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="relative z-[1] h-full w-full object-contain p-0.5" draggable={false} />
            ) : (
              <span
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                  backgroundSize: "5px 5px",
                  backgroundPosition: "0 0, 0 2.5px, 2.5px -2.5px, -2.5px 0px",
                }}
                aria-hidden
              />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Company logo</p>
          </div>
        </button>
      </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 ring-1 ring-border/50 hover:bg-muted/25">
          <Label
            htmlFor={`splash-show-logo-${block.id}`}
            className={cn("cursor-pointer", SPLASH_TOOLBAR_SECTION_LABEL_CLASS)}
          >
            Show company logo
          </Label>
          <Switch
            id={`splash-show-logo-${block.id}`}
            checked={block.showLogo !== false}
            disabled={!logoUrl}
            onCheckedChange={(checked) => {
              const next = sanitizeSplashContentAlignmentForLogo({ ...block, showLogo: checked }, logoUrl);
              onChange(next);
            }}
          />
        </div>

        {block.showLogo !== false && logoUrl ? (
          <>
            <SplashHorizontalAlignButtons
              label="Logo alignment"
              value={resolveSplashLogoHorizontal(block)}
              onChange={(horizontal) => onChange(applySplashLogoHorizontal(block, horizontal))}
            />

            <div className="space-y-2">
              <Label className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Logo size</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {SPLASH_LOGO_SIZE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.id}
                    type="button"
                    size="sm"
                    variant={logoSize === opt.id ? "default" : "outline"}
                    className="h-8 px-2 text-xs"
                    onClick={() => onChange({ ...block, logoSize: opt.id })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ProposalSplashBackgroundPicker({
  block,
  onChange,
  isFirstRootSplash = false,
}: {
  block: SplashBlock;
  onChange: (next: SplashBlock) => void;
  /** This splash is the first top-level block (logo tab + company logo target). */
  isFirstRootSplash?: boolean;
}) {
  const mediaLibrary = useProposalMediaLibraryOptional();
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
  const showLogoTab = isFirstRootSplash;
  const brandingCtx = useProposalBrandingOptional();
  const templateLogoUrl = brandingCtx?.branding?.logoUrl?.trim() ?? "";
  const logoReservesTopBand = showLogoTab && splashLogoReservesTopBand(block, templateLogoUrl);
  const headlineLayoutPresets = logoReservesTopBand
    ? LAYOUT_PRESETS.filter((p) => p.vertical !== "top")
    : LAYOUT_PRESETS;

  function patchBg(part: Partial<SplashBlockBackground>) {
    onChange(patchBackground(block, part));
  }

  const mediaFill = SplashBackgroundTriggerMedia(model, resolved);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Background"
          aria-label="Background"
          className={cn(
            "relative inline-flex h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-muted/90 transition-colors hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-background dark:ring-offset-zinc-800",
            mediaFill ? "overflow-hidden p-0 ring-border" : "items-center justify-center",
            resolved.kind !== "color" || model.color ? "ring-border" : "ring-border ring-dashed",
          )}
        >
          {mediaFill ? (
            mediaFill
          ) : (
            <>
              <Paintbrush className="h-4 w-4 text-muted-foreground" />
              <span className="pointer-events-none absolute inset-0">
                <span
                  className="absolute bottom-1 right-1 h-4 w-4 rounded-full ring-[1.5px] ring-border"
                  style={{ backgroundColor: resolved.colorHex }}
                />
              </span>
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[min(272px,calc(100vw-2rem))] overflow-hidden rounded-lg border-0 bg-popover p-0 text-popover-foreground shadow-xl ring-1 ring-black/[0.06] dark:ring-white/10"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("[data-background-tint-popover]")) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("[data-background-tint-popover]")) e.preventDefault();
        }}
      >
        <Tabs defaultValue="background" className="w-full">
          <TabsList
            className={cn(
              "mx-2 mt-1.5 grid h-8 w-[calc(100%-1rem)] items-stretch gap-0 rounded-md bg-muted/60 p-0.5",
              showLogoTab ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            <TabsTrigger
              value="background"
              className="h-full min-h-0 w-full rounded-[6px] px-1.5 py-0 text-[11px] font-semibold data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none"
            >
              Background
            </TabsTrigger>
            <TabsTrigger
              value="layout"
              className="h-full min-h-0 w-full rounded-[6px] px-1.5 py-0 text-[11px] font-semibold data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none"
            >
              Layout
            </TabsTrigger>
            {showLogoTab ? (
              <TabsTrigger
                value="logo"
                className="h-full min-h-0 w-full rounded-[6px] px-1.5 py-0 text-[11px] font-semibold data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none"
              >
                Logo
              </TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="background" className="mt-0 outline-none">
            <div className="max-h-[min(58vh,460px)] overflow-y-auto overflow-x-hidden">
          <div className="border-b border-border/60 px-3 py-2.5">
            <p className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Background type</p>
            <Tabs
              value={model.type}
              onValueChange={(v) => {
                const t = v as SplashBlockBackground["type"];
                if (t === "color") patchBg({ type: "color", url: undefined, videoUrl: undefined });
                else if (t === "image") patchBg({ type: "image", videoUrl: undefined });
                else patchBg({ type: "video" });
              }}
              className="mt-2"
            >
              <TabsList className="grid h-8 w-full grid-cols-3 items-stretch gap-0 rounded-md border-0 bg-muted/60 p-0.5 shadow-none">
                <TabsTrigger
                  value="color"
                  className="h-full min-h-0 w-full rounded-[6px] px-2 py-0 text-[11px] font-semibold data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none"
                >
                  Color
                </TabsTrigger>
                <TabsTrigger
                  value="image"
                  className="h-full min-h-0 w-full rounded-[6px] px-2 py-0 text-[11px] font-semibold data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none"
                >
                  Image
                </TabsTrigger>
                <TabsTrigger
                  value="video"
                  className="h-full min-h-0 w-full rounded-[6px] px-2 py-0 text-[11px] font-semibold data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none"
                >
                  Video
                </TabsTrigger>
              </TabsList>
              <TabsContent value="color" className="mt-2 space-y-2 outline-none">
                <TintSwatchPicker
                  label="Backdrop color"
                  value={normalizeHex(model.color) ?? "#0f172a"}
                  onChange={(c) => patchBg({ type: "color", color: c })}
                />
                <SplashBackgroundTintPopover
                  tintColor={model.tintColor}
                  tintMode={model.tintMode}
                  tintOpacity={model.tintOpacity}
                  blur={model.blur}
                  onPatch={patchBg}
                />
              </TabsContent>
              <TabsContent value="image" className="mt-2 space-y-1.5 outline-none">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ring-1 ring-border/50 transition-colors",
                    mediaLibrary && "cursor-pointer hover:bg-muted/35 hover:ring-border/70",
                    !mediaLibrary && "bg-muted/10",
                  )}
                  onClick={() => {
                    if (mediaLibrary) {
                      setOpen(false);
                      window.setTimeout(() => {
                        mediaLibrary.openSelection({
                          allowedKinds: ["image"],
                          onSelect: (asset) => {
                            if (asset.kind !== "image") return;
                            patchBg({ type: "image", url: asset.downloadUrl });
                          },
                        });
                      }, 0);
                      return;
                    }
                    document.getElementById(`splash-img-url-${block.id}`)?.focus();
                  }}
                >
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/20">
                    {model.url?.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={model.url.trim()} alt="" className="relative z-[1] h-full w-full object-cover" draggable={false} />
                    ) : (
                      <>
                        <span
                          className="absolute inset-0 opacity-50"
                          style={{
                            backgroundImage:
                              "linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                            backgroundSize: "5px 5px",
                            backgroundPosition: "0 0, 0 2.5px, 2.5px -2.5px, -2.5px 0px",
                          }}
                          aria-hidden
                        />
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Background image</p>
                    <p className="mt-0.5 truncate text-[10px] leading-snug text-muted-foreground">
                      {model.url?.trim() || (mediaLibrary ? "Library or paste a HTTPS URL" : "Paste a HTTPS URL")}
                    </p>
                  </div>
                </button>
                <div className="space-y-1 pt-0.5">
                  <Label className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Image URL</Label>
                  <Input
                    id={`splash-img-url-${block.id}`}
                    value={model.url ?? ""}
                    onChange={(e) => patchBg({ type: "image", url: e.target.value })}
                    placeholder="https://…"
                    spellCheck={false}
                    className="h-8 rounded-md border-border/80 text-xs"
                  />
                </div>
                <SplashBackgroundTintPopover
                  tintColor={model.tintColor}
                  tintMode={model.tintMode}
                  tintOpacity={model.tintOpacity}
                  blur={model.blur}
                  onPatch={patchBg}
                />
              </TabsContent>
              <TabsContent value="video" className="mt-2 space-y-1.5 outline-none">
                <button
                  type="button"
                  disabled={!mediaLibrary}
                  title={!mediaLibrary ? "Media library is not available in this context" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ring-1 ring-border/50 transition-colors",
                    mediaLibrary && "cursor-pointer hover:bg-muted/35 hover:ring-border/70",
                    !mediaLibrary && "cursor-not-allowed opacity-60",
                  )}
                  onClick={() => {
                    if (!mediaLibrary) return;
                    setOpen(false);
                    window.setTimeout(() => {
                      mediaLibrary.openSelection({
                        allowedKinds: ["video"],
                        onSelect: (asset) => {
                          if (asset.kind !== "video") return;
                          patchBg({ type: "video", videoUrl: asset.downloadUrl, posterUrl: undefined });
                        },
                      });
                    }, 0);
                  }}
                >
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/20">
                    {!model.videoUrl?.trim() ? (
                      <>
                        <span
                          className="absolute inset-0 opacity-50"
                          style={{
                            backgroundImage:
                              "linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                            backgroundSize: "5px 5px",
                            backgroundPosition: "0 0, 0 2.5px, 2.5px -2.5px, -2.5px 0px",
                          }}
                          aria-hidden
                        />
                        <MonitorPlay className="relative z-[1] h-4 w-4 text-muted-foreground" aria-hidden />
                      </>
                    ) : model.videoUrl.trim() && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(model.videoUrl.trim()) ? (
                      <video
                        muted
                        playsInline
                        preload="metadata"
                        className="relative z-[1] h-full w-full object-cover"
                        src={model.videoUrl.trim()}
                      />
                    ) : (
                      <MonitorPlay className="relative z-[1] h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Background video</p>
                  </div>
                </button>
                <SplashBackgroundTintPopover
                  tintColor={model.tintColor}
                  tintMode={model.tintMode}
                  tintOpacity={model.tintOpacity}
                  blur={model.blur}
                  onPatch={patchBg}
                />
                <button
                  type="button"
                  disabled={!mediaLibrary}
                  title={!mediaLibrary ? "Media library is not available in this context" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ring-1 ring-border/50 transition-colors",
                    mediaLibrary && "cursor-pointer hover:bg-muted/35 hover:ring-border/70",
                    !mediaLibrary && "cursor-not-allowed opacity-60",
                  )}
                  onClick={() => {
                    if (!mediaLibrary) return;
                    setOpen(false);
                    window.setTimeout(() => {
                      mediaLibrary.openSelection({
                        allowedKinds: ["image"],
                        onSelect: (asset) => {
                          if (asset.kind !== "image") return;
                          patchBg({ posterUrl: asset.downloadUrl });
                        },
                      });
                    }, 0);
                  }}
                >
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/20">
                    {model.posterUrl?.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={model.posterUrl.trim()} alt="" className="relative z-[1] h-full w-full object-cover" draggable={false} />
                    ) : (
                      <>
                        <span
                          className="absolute inset-0 opacity-50"
                          style={{
                            backgroundImage:
                              "linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                            backgroundSize: "5px 5px",
                            backgroundPosition: "0 0, 0 2.5px, 2.5px -2.5px, -2.5px 0px",
                          }}
                          aria-hidden
                        />
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Mobile image fallback</p>
                  </div>
                </button>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-3 border-t border-border/60 px-3 py-3">
            <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 ring-1 ring-border/50 hover:bg-muted/25">
              <Label
                htmlFor={`splash-background-card-${block.id}`}
                className={cn("cursor-pointer", SPLASH_TOOLBAR_SECTION_LABEL_CLASS)}
              >
                Background card
              </Label>
              <Switch
                id={`splash-background-card-${block.id}`}
                checked={Boolean(block.showCard)}
                onCheckedChange={(checked) => onChange({ ...block, showCard: checked })}
              />
            </div>
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
                <Label className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Content position</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  value={positionSelectValue}
                  aria-label="Headline and body position"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "custom") {
                      setCustomLayoutOpen(true);
                      return;
                    }
                    setCustomLayoutOpen(false);
                    onChange(applyLayoutPreset(block, v, templateLogoUrl));
                  }}
                >
                  {headlineLayoutPresets.map((p) => (
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
                        <Label className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Vertical</Label>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={block.alignment.vertical}
                          onChange={(e) => {
                            const vertical = e.target.value as SplashBlock["alignment"]["vertical"];
                            if (logoReservesTopBand && vertical === "top") return;
                            onChange({
                              ...block,
                              alignment: {
                                ...block.alignment,
                                vertical,
                              },
                            });
                          }}
                        >
                          <option value="top" disabled={logoReservesTopBand}>
                            Top
                          </option>
                          <option value="center">Center</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Horizontal</Label>
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

              <div className="space-y-2">
                <Label className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Height</Label>
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
                    <Label className={SPLASH_TOOLBAR_SECTION_LABEL_CLASS}>Custom</Label>
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

          {showLogoTab ? (
            <TabsContent value="logo" className="mt-0 outline-none data-[state=inactive]:hidden">
              <SplashLogoSettingsPanel block={block} onChange={onChange} onCloseMenu={() => setOpen(false)} />
            </TabsContent>
          ) : null}
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Splash background control with template branding props from context. */
export function ProposalSplashBackgroundPickerWithBranding({
  block,
  onChange,
}: {
  block: SplashBlock;
  onChange: (next: SplashBlock) => void;
}) {
  const branding = useSplashBackgroundPickerBranding(block.id);
  return (
    <ProposalSplashBackgroundPicker
      block={block}
      onChange={onChange}
      isFirstRootSplash={branding.isFirstRootSplash}
    />
  );
}

export function SplashBlockInspector({ block, onChange }: { block: SplashBlock; onChange: (next: SplashBlock) => void }) {
  const html = block.html ?? (block.body ? `<p>${escapeHtml(block.body)}</p>` : "<p></p>");
  const companyLogoUrl = useSplashCompanyLogoUrl(block.id);
  const splashLogo =
    companyLogoUrl && block.showLogo !== false ? companyLogoUrl : null;

  return (
    <ProposalSplashBlockCanvas block={block} mode="editor" logoUrl={splashLogo}>
      <ProposalRichText
        key={block.id}
        html={html}
        onChange={(nextHtml) => onChange({ ...block, html: nextHtml, body: undefined })}
        placeholder="Start typing…"
        className="min-h-[120px] !px-0 !py-0 border-white/25 bg-black/30 text-white [&_p]:text-white/90"
      />
    </ProposalSplashBlockCanvas>
  );
}
