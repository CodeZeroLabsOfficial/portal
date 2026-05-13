"use client";

import * as React from "react";
import { Check, ImageIcon, Layers, MonitorPlay } from "lucide-react";
import { STYLE_PRESET_COLORS } from "@/lib/block-style";
import {
  defaultSectionBackground,
  isSectionBackgroundActive,
  mergeSectionBackground,
  resolveSectionBackground,
  type ResolvedSectionBackground,
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
import { useProposalMediaLibraryOptional } from "@/components/proposal/proposal-media-library";
import { SectionBackgroundTintPopover } from "@/components/proposal/proposal-background-tint-popover";
import { youtubeThumbnailFromPageUrl } from "@/components/proposal/embed-video";

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
  const mediaLibrary = useProposalMediaLibraryOptional();
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
      posterUrl: next === "video" ? (model.kind === "video" ? model.posterUrl : undefined) : undefined,
    });
  }

  const labelMuted = elevated ? "text-zinc-400" : "text-muted-foreground";

  const showMediaFill =
    resolvedPreview.active &&
    resolvedPreview.mediaUrl &&
    (resolvedPreview.kind === "image" || resolvedPreview.kind === "video");

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Background"
          aria-label="Background"
          className={cn(
            "relative inline-flex h-8 w-8 rounded-full ring-2 transition-colors focus:outline-none focus-visible:ring-2",
            showMediaFill ? "overflow-hidden p-0 ring-border" : "items-center justify-center",
            elevated
              ? "text-zinc-200 hover:bg-white/10 focus-visible:ring-white/35 data-[state=open]:bg-white/15"
              : "text-muted-foreground ring-offset-2 ring-offset-muted/90 hover:bg-background hover:text-foreground focus-visible:ring-ring data-[state=open]:bg-background data-[state=open]:shadow-sm dark:ring-offset-zinc-800",
            hasPersistedBackdrop ? "" : elevated ? "ring-white/35" : "ring-border ring-dashed",
          )}
        >
          {showMediaFill ? (
            <SectionBackgroundTriggerMediaFill model={model} preview={resolvedPreview} />
          ) : (
            <>
              <Layers className={cn("h-4 w-4", elevated && !hasPersistedBackdrop && "opacity-90")} />
              <PreviewSwatchMini model={model} elevated={elevated} />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={8}
        className={cn(
          "w-[min(272px,calc(100vw-2rem))] overflow-hidden rounded-lg border-0 p-0 shadow-xl",
          elevated
            ? "bg-zinc-900/95 text-zinc-100 ring-1 ring-white/15"
            : "bg-popover text-popover-foreground ring-1 ring-black/[0.06] dark:ring-white/10",
        )}
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
        <div className={cn("border-b px-3 py-2.5", elevated ? "border-white/10" : "border-border/60")}>
          <p className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", labelMuted)}>Background type</p>
          <Tabs
            value={model.kind}
            onValueChange={(v) => setKind(v as SectionBackdropKind)}
            className="mt-2"
          >
            <TabsList
              className={cn(
                "grid h-8 w-full grid-cols-3 items-stretch gap-0 rounded-md border-0 p-0.5 shadow-none",
                elevated ? "bg-black/55" : "bg-muted/60",
              )}
            >
              <TabsTrigger
                value="color"
                className={cn(
                  "h-full min-h-0 w-full rounded-[6px] px-2 py-0 text-[11px] font-semibold data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none",
                  elevated && "text-zinc-400 data-[state=active]:bg-zinc-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
                )}
              >
                Color
              </TabsTrigger>
              <TabsTrigger
                value="image"
                className={cn(
                  "h-full min-h-0 w-full rounded-[6px] px-2 py-0 text-[11px] font-semibold data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none",
                  elevated && "text-zinc-400 data-[state=active]:bg-zinc-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
                )}
              >
                Image
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className={cn(
                  "h-full min-h-0 w-full rounded-[6px] px-2 py-0 text-[11px] font-semibold data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none",
                  elevated && "text-zinc-400 data-[state=active]:bg-zinc-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
                )}
              >
                Video
              </TabsTrigger>
            </TabsList>
            <TabsContent value="color" className="mt-2 space-y-2 outline-none">
              <TintSwatchPicker
                elevated={elevated}
                label="Backdrop color"
                value={normalizeHex(model.color) ?? "#0f172a"}
                onChange={(c) => patch({ kind: "color", color: c, mediaUrl: undefined })}
              />
              <SectionBackgroundTintPopover
                elevated={elevated}
                labelMuted={labelMuted}
                tintColor={model.tintColor}
                tintStyle={model.tintStyle}
                tintOpacity={model.tintOpacity}
                blurStrength={model.blurStrength}
                onPatch={patch}
              />
            </TabsContent>
            <TabsContent value="image" className="mt-2 space-y-2 outline-none">
              <MiniAssetRow
                elevated={elevated}
                kind="image"
                url={model.mediaUrl}
                rowTitle="Background image"
                onPickFromLibrary={
                  mediaLibrary
                    ? () => {
                        setMenuOpen(false);
                        window.setTimeout(() => {
                          mediaLibrary.openSelection({
                            allowedKinds: ["image"],
                            onSelect: (asset) => {
                              if (asset.kind !== "image") return;
                              patch({ kind: "image", mediaUrl: asset.downloadUrl });
                            },
                          });
                        }, 0);
                      }
                    : undefined
                }
              />
              <div className="space-y-1 pt-1.5">
                <Label className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", labelMuted)}>
                  Image URL
                </Label>
                <Input
                  value={model.mediaUrl ?? ""}
                  onChange={(e) => patch({ kind: "image", mediaUrl: e.target.value })}
                  placeholder="https://…"
                  className={cn(
                    "h-8 rounded-md text-xs",
                    elevated ? "border-zinc-700 bg-zinc-900 text-zinc-100" : "border-border/80",
                  )}
                  spellCheck={false}
                />
              </div>
              <SectionBackgroundTintPopover
                elevated={elevated}
                labelMuted={labelMuted}
                tintColor={model.tintColor}
                tintStyle={model.tintStyle}
                tintOpacity={model.tintOpacity}
                blurStrength={model.blurStrength}
                onPatch={patch}
              />
            </TabsContent>
            <TabsContent value="video" className="mt-2 space-y-1.5 outline-none">
              <MiniAssetRow
                elevated={elevated}
                kind="video"
                url={model.mediaUrl}
                rowTitle="Background video"
                emptyHint="Choose from library"
                onPickFromLibrary={
                  mediaLibrary
                    ? () => {
                        setMenuOpen(false);
                        window.setTimeout(() => {
                          mediaLibrary.openSelection({
                            allowedKinds: ["video"],
                            onSelect: (asset) => {
                              if (asset.kind !== "video") return;
                              patch({ kind: "video", mediaUrl: asset.downloadUrl, posterUrl: undefined });
                            },
                          });
                        }, 0);
                      }
                    : undefined
                }
              />
              <SectionBackgroundTintPopover
                elevated={elevated}
                labelMuted={labelMuted}
                tintColor={model.tintColor}
                tintStyle={model.tintStyle}
                tintOpacity={model.tintOpacity}
                blurStrength={model.blurStrength}
                onPatch={patch}
              />
              <MiniAssetRow
                elevated={elevated}
                kind="image"
                url={model.posterUrl}
                rowTitle="Mobile image fallback"
                emptyHint="Choose from library"
                onPickFromLibrary={
                  mediaLibrary
                    ? () => {
                        setMenuOpen(false);
                        window.setTimeout(() => {
                          mediaLibrary.openSelection({
                            allowedKinds: ["image"],
                            onSelect: (asset) => {
                              if (asset.kind !== "image") return;
                              patch({ kind: "video", posterUrl: asset.downloadUrl });
                            },
                          });
                        }, 0);
                      }
                    : undefined
                }
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-3 px-3 py-3">
          <div className={cn("flex flex-wrap gap-2 border-t pt-2", elevated ? "border-white/10" : "border-border/60")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 flex-1 rounded-md text-[11px] font-medium",
                elevated ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-border/80",
              )}
              onClick={() => onChange(undefined)}
              disabled={!background}
            >
              Clear background
            </Button>
          </div>
          <p className={cn("text-[10px] leading-snug", labelMuted)}>
            {resolvedPreview.active
              ? "Shown on preview and shared pages after save."
              : "Pick a backdrop, then tune tint and blur."}
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SectionBackgroundTriggerMediaFill({
  model,
  preview,
}: {
  model: SectionBackground;
  preview: ResolvedSectionBackground;
}) {
  const url = preview.mediaUrl;
  if (!url) return null;

  if (preview.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary author URLs
      <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
    );
  }

  const poster = model.posterUrl?.trim();
  if (poster) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt="" className="h-full w-full object-cover" draggable={false} />
    );
  }
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
    return (
      <video className="h-full w-full object-cover" muted playsInline preload="metadata" src={url} aria-hidden />
    );
  }
  const yt = youtubeThumbnailFromPageUrl(url);
  if (yt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={yt} alt="" className="h-full w-full object-cover" draggable={false} />
    );
  }
  return <span className="block h-full w-full bg-muted" aria-hidden />;
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
        model.posterUrl?.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={model.posterUrl.trim()}
            alt=""
            className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 rounded-full object-cover ring-[1.5px] ring-neutral-950/80"
            draggable={false}
          />
        ) : (
          <video
            className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 rounded-full object-cover ring-[1.5px] ring-neutral-950/80"
            muted
            playsInline
            preload="metadata"
            src={preview.mediaUrl}
          />
        )
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
  rowTitle,
  emptyHint,
  onPickFromLibrary,
}: {
  elevated?: boolean;
  kind: "image" | "video";
  url?: string;
  rowTitle?: string;
  emptyHint?: string;
  onPickFromLibrary?: () => void;
}) {
  const labelMuted = elevated ? "text-zinc-400" : "text-muted-foreground";
  const trimmed = (url ?? "").trim();
  const titleText = rowTitle ?? `Background ${kind === "image" ? "image" : "video"}`;
  const defaultEmptyHint = onPickFromLibrary ? "Library or paste a HTTPS URL" : "Paste a HTTPS URL";
  const subtitle = trimmed || (emptyHint ?? defaultEmptyHint);
  const rowClass = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ring-1 ring-border/50 transition-colors",
    onPickFromLibrary && "cursor-pointer hover:bg-muted/35 hover:ring-border/70",
    elevated && onPickFromLibrary && "ring-white/12 hover:bg-white/5 hover:ring-white/20",
    !onPickFromLibrary && "bg-muted/10",
  );

  const checkerboard = (
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
  );

  const thumb = (
    <div
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/20",
        elevated ? "border-white/12" : "border-border/60",
      )}
    >
      {!trimmed ? (
        <>
          {checkerboard}
          {kind === "video" ? (
            <MonitorPlay className="relative z-[1] h-4 w-4 text-muted-foreground" aria-hidden />
          ) : null}
        </>
      ) : kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={trimmed} alt="" className="relative z-[1] h-full w-full object-cover" draggable={false} />
      ) : (
        <video
          muted
          playsInline
          preload="metadata"
          className="relative z-[1] h-full w-full object-cover"
          src={trimmed}
        />
      )}
    </div>
  );

  const text = (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold leading-tight text-foreground">{titleText}</p>
      <p className={cn("mt-0.5 truncate text-[10px] leading-snug", labelMuted)}>{subtitle}</p>
    </div>
  );

  if (onPickFromLibrary) {
    return (
      <button type="button" className={rowClass} onClick={() => onPickFromLibrary()}>
        {thumb}
        {text}
      </button>
    );
  }
  return (
    <div className={rowClass}>
      {thumb}
      {text}
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
      {label ? (
        <p className={cn("mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]", labelMuted)}>{label}</p>
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
                isActive ? cn("ring-2 ring-ring ring-offset-1", ringActive) : swatchIdle,
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
      <div
        className={cn(
          "mt-1.5 flex h-8 items-center gap-2 rounded-md border px-2 py-0",
          elevated ? "border-zinc-700/70 bg-black/40" : "border-border/70 bg-muted/30",
        )}
      >
        <span className={cn("h-5 w-5 shrink-0 rounded-full ring-1", elevated ? "ring-zinc-600" : "ring-border")} style={{ backgroundColor: value }} />
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitDraft()}
          spellCheck={false}
          aria-label={label ? `${label} hex` : "Colour hex"}
          className={cn(
            "h-7 border-0 bg-transparent p-0 text-xs font-medium tabular-nums tracking-tight",
            elevated ? "text-zinc-100" : "text-foreground",
          )}
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
