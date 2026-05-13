"use client";

import * as React from "react";
import { Check, Pipette } from "lucide-react";
import { STYLE_PRESET_COLORS } from "@/lib/block-style";
import { cn } from "@/lib/utils";
import type { SectionBackground, SplashBlockBackground } from "@/types/proposal";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const x = n.slice(1);
  return {
    r: parseInt(x.slice(0, 2), 16),
    g: parseInt(x.slice(2, 4), 16),
    b: parseInt(x.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  h *= 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h >= 0 && h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

function RangeRowTint({
  elevated,
  labelMuted,
  label,
  value,
  min,
  max,
  suffix,
  format,
  onChange,
}: {
  elevated?: boolean;
  labelMuted: string;
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
        <p className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", labelMuted)}>{label}</p>
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
        className={cn(
          "h-1.5 w-full cursor-pointer accent-sky-500 hover:accent-sky-600",
          elevated && "[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full",
        )}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function SatValPlane({
  hue,
  s,
  v,
  elevated,
  onPick,
}: {
  hue: number;
  s: number;
  v: number;
  elevated?: boolean;
  onPick: (nextS: number, nextV: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const pure = `hsl(${Math.round(hue)}, 100%, 50%)`;

  const pick = React.useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const ny = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      onPick(nx, 1 - ny);
    },
    [onPick],
  );

  return (
    <div
      ref={ref}
      className={cn(
        "relative h-[118px] w-full cursor-crosshair touch-none select-none overflow-hidden rounded-md",
        elevated && "ring-1 ring-inset ring-white/10",
      )}
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})`,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!(e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) return;
        pick(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }}
    >
      <div
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/25"
        style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
      />
    </div>
  );
}

function TintAdvancedColorBlock({
  elevated,
  labelMuted,
  popoverOpen,
  tintHex,
  onTintColor,
}: {
  elevated?: boolean;
  labelMuted: string;
  popoverOpen: boolean;
  tintHex: string;
  onTintColor: (hex: string) => void;
}) {
  const [hsv, setHsv] = React.useState(() => {
    const rgb = hexToRgb(tintHex) ?? { r: 0, g: 0, b: 0 };
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  });
  const [draftHex, setDraftHex] = React.useState(tintHex);

  React.useEffect(() => setDraftHex(tintHex), [tintHex]);

  React.useEffect(() => {
    if (!popoverOpen) return;
    const rgb = hexToRgb(tintHex) ?? { r: 0, g: 0, b: 0 };
    setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
  }, [popoverOpen, tintHex]);

  function applyHsv(next: { h?: number; s?: number; v?: number }) {
    setHsv((prev) => {
      const h = next.h ?? prev.h;
      const s = next.s ?? prev.s;
      const v = next.v ?? prev.v;
      onTintColor(hsvToHex(h, s, v));
      return { h, s, v };
    });
  }

  async function pickFromScreen() {
    const Ctor = (typeof window !== "undefined" &&
      (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper) as
      | (new () => { open: () => Promise<{ sRGBHex: string }> })
      | undefined;
    if (!Ctor) return;
    try {
      const eye = new Ctor();
      const { sRGBHex } = await eye.open();
      const n = normalizeHex(sRGBHex);
      if (n) {
        onTintColor(n);
        const rgb = hexToRgb(n) ?? { r: 0, g: 0, b: 0 };
        setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
        setDraftHex(n);
      }
    } catch {
      /* user cancelled */
    }
  }

  function commitDraft() {
    const n = normalizeHex(draftHex.trim());
    if (n) {
      onTintColor(n);
      const rgb = hexToRgb(n) ?? { r: 0, g: 0, b: 0 };
      setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
    } else setDraftHex(tintHex);
  }

  const eyeSupported =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { EyeDropper?: unknown }).EyeDropper);

  return (
    <div>
      <p className={cn("mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]", labelMuted)}>Tint colour</p>
      <div className="grid grid-cols-6 gap-1.5">
        {STYLE_PRESET_COLORS.map((c) => {
          const isActive = sameHex(c.value, tintHex);
          return (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              title={c.label}
              className={cn(
                "relative h-7 w-7 rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isActive
                  ? cn("ring-2 ring-ring ring-offset-1", elevated ? "ring-offset-zinc-900" : "ring-offset-background")
                  : elevated
                    ? "border-zinc-700 hover:scale-105"
                    : "border-border hover:scale-105",
              )}
              style={{ backgroundColor: c.value }}
              onClick={() => {
                onTintColor(c.value);
                const rgb = hexToRgb(c.value) ?? { r: 0, g: 0, b: 0 };
                setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
                setDraftHex(c.value);
              }}
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

      <div className="mt-2 space-y-2">
        <SatValPlane hue={hsv.h} s={hsv.s} v={hsv.v} elevated={elevated} onPick={(s, v) => applyHsv({ s, v })} />
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(hsv.h)}
          aria-label="Hue"
          className={cn(
            "h-1.5 w-full cursor-pointer accent-sky-500",
            "[background:linear-gradient(to_right,red,#ff0,#0f0,#0ff,#00f,#f0f,red)] rounded-full",
          )}
          onChange={(e) => applyHsv({ h: Number(e.target.value) })}
        />
      </div>

      <div
        className={cn(
          "mt-2 flex h-8 items-center gap-1.5 rounded-md border px-2 py-0",
          elevated ? "border-zinc-700/70 bg-black/40" : "border-border/70 bg-muted/30",
        )}
      >
        <span
          className={cn("h-5 w-5 shrink-0 rounded-full ring-1", elevated ? "ring-zinc-600" : "ring-border")}
          style={{ backgroundColor: tintHex }}
        />
        <Input
          type="text"
          value={draftHex}
          onChange={(e) => setDraftHex(e.target.value)}
          onBlur={() => commitDraft()}
          spellCheck={false}
          aria-label="Tint colour hex"
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent p-0 text-xs font-medium tabular-nums tracking-tight",
            elevated ? "text-zinc-100" : "text-foreground",
          )}
          placeholder="#000000"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
        {eyeSupported ? (
          <button
            type="button"
            title="Pick colour from screen"
            aria-label="Pick colour from screen"
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
              elevated ? "text-zinc-300 hover:bg-white/10" : "text-muted-foreground hover:bg-muted/60",
            )}
            onClick={() => void pickFromScreen()}
          >
            <Pipette className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TintTriggerRow({
  elevated,
  tintHex,
  open,
}: {
  elevated?: boolean;
  tintHex: string;
  open?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ring-1 ring-border/50 transition-colors",
        "cursor-pointer hover:bg-muted/35 hover:ring-border/70",
        open && !elevated && "bg-sky-500/10 ring-sky-500/30",
        open && elevated && "bg-white/10 ring-white/25",
        elevated && "ring-white/12 hover:bg-white/5 hover:ring-white/20",
      )}
    >
      <div
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/25",
          elevated ? "border-white/15" : "border-border/60",
        )}
      >
        <span
          className="absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #c4c4cc 25%, transparent 25%), linear-gradient(-45deg, #c4c4cc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e2e8 75%), linear-gradient(-45deg, transparent 75%, #e2e2e8 75%)",
            backgroundSize: "5px 5px",
            backgroundPosition: "0 0, 0 2.5px, 2.5px -2.5px, -2.5px 0px",
          }}
          aria-hidden
        />
        <span
          className="relative z-[1] h-5 w-5 rounded-full shadow-sm ring-1 ring-black/10"
          style={{ backgroundColor: tintHex }}
        />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className={cn("text-xs font-semibold text-foreground", elevated && "text-zinc-100")}>Background tint</p>
        <p className={cn("truncate text-[10px]", elevated ? "text-zinc-400" : "text-muted-foreground")}>
          Colour, style, opacity &amp; blur
        </p>
      </div>
    </span>
  );
}

function TintPopoverInner({
  elevated,
  labelMuted,
  popoverOpen,
  tintHex,
  onTintColor,
  styleBlend,
  onStyleNormal,
  onStyleBlend,
  tintOpacity,
  onTintOpacity,
  blur,
  onBlur,
  opacitySuffix,
}: {
  elevated?: boolean;
  labelMuted: string;
  popoverOpen: boolean;
  tintHex: string;
  onTintColor: (hex: string) => void;
  styleBlend: boolean;
  onStyleNormal: () => void;
  onStyleBlend: () => void;
  tintOpacity: number;
  onTintOpacity: (n: number) => void;
  blur: number;
  onBlur: (n: number) => void;
  opacitySuffix: string;
}) {
  return (
    <div className="space-y-3">
      <TintAdvancedColorBlock
        elevated={elevated}
        labelMuted={labelMuted}
        popoverOpen={popoverOpen}
        tintHex={tintHex}
        onTintColor={onTintColor}
      />

      <div>
        <p className={cn("mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]", labelMuted)}>Tint style</p>
        <div
          className={cn(
            "inline-flex h-8 w-full rounded-md p-0.5",
            elevated ? "bg-zinc-800/90 ring-1 ring-inset ring-white/10" : "bg-muted/60 ring-1 ring-inset ring-border/60",
          )}
        >
          <button
            type="button"
            className={cn(
              "h-7 flex-1 rounded-[6px] text-[11px] font-semibold transition-colors",
              !styleBlend
                ? elevated
                  ? "bg-zinc-600 text-white shadow-sm"
                  : "bg-background text-foreground shadow-sm"
                : elevated
                  ? "text-zinc-400 hover:text-zinc-200"
                  : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={!styleBlend}
            onClick={onStyleNormal}
          >
            Normal
          </button>
          <button
            type="button"
            className={cn(
              "h-7 flex-1 rounded-[6px] text-[11px] font-semibold transition-colors",
              styleBlend
                ? elevated
                  ? "bg-zinc-600 text-white shadow-sm"
                  : "bg-background text-foreground shadow-sm"
                : elevated
                  ? "text-zinc-400 hover:text-zinc-200"
                  : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={styleBlend}
            onClick={onStyleBlend}
          >
            Blend
          </button>
        </div>
      </div>

      <RangeRowTint
        elevated={elevated}
        labelMuted={labelMuted}
        label="Tint opacity"
        value={tintOpacity}
        min={0}
        max={100}
        suffix={opacitySuffix}
        format={(n) => String(Math.round(n))}
        onChange={onTintOpacity}
      />
      <RangeRowTint
        elevated={elevated}
        labelMuted={labelMuted}
        label="Background blur"
        value={blur}
        min={0}
        max={24}
        suffix=" px"
        format={(n) => String(Math.round(n))}
        onChange={onBlur}
      />
    </div>
  );
}

export function SectionBackgroundTintPopover({
  elevated,
  labelMuted,
  tintColor,
  tintStyle = "normal",
  tintOpacity = 16,
  blurStrength = 0,
  onPatch,
}: {
  elevated?: boolean;
  labelMuted: string;
  tintColor?: string;
  tintStyle?: "normal" | "blend";
  tintOpacity?: number;
  blurStrength?: number;
  onPatch: (p: Partial<SectionBackground>) => void;
}) {
  const [poOpen, setPoOpen] = React.useState(false);
  const tintHex = normalizeHex(tintColor) ?? "#000000";

  return (
    <Popover open={poOpen} onOpenChange={setPoOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <TintTriggerRow elevated={elevated} tintHex={tintHex} open={poOpen} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-background-tint-popover=""
        side="bottom"
        align="start"
        className={cn(
          "w-[min(252px,calc(100vw-2rem))] p-3",
          elevated && "border-white/15 bg-zinc-900/98 text-zinc-100 ring-1 ring-white/12",
        )}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <TintPopoverInner
          elevated={elevated}
          labelMuted={labelMuted}
          popoverOpen={poOpen}
          tintHex={tintHex}
          onTintColor={(hex) => onPatch({ tintColor: hex })}
          styleBlend={tintStyle === "blend"}
          onStyleNormal={() => onPatch({ tintStyle: "normal" })}
          onStyleBlend={() => onPatch({ tintStyle: "blend" })}
          tintOpacity={tintOpacity}
          onTintOpacity={(v) => onPatch({ tintOpacity: Math.round(v) })}
          blur={blurStrength}
          onBlur={(v) => onPatch({ blurStrength: Math.round(v) })}
          opacitySuffix=""
        />
      </PopoverContent>
    </Popover>
  );
}

export function SplashBackgroundTintPopover({
  tintColor,
  tintMode = "normal",
  tintOpacity = 35,
  blur = 0,
  onPatch,
}: {
  tintColor?: string;
  tintMode?: "normal" | "blend";
  tintOpacity?: number;
  blur?: number;
  onPatch: (p: Partial<SplashBlockBackground>) => void;
}) {
  const [poOpen, setPoOpen] = React.useState(false);
  const tintHex = normalizeHex(tintColor) ?? "#000000";

  return (
    <Popover open={poOpen} onOpenChange={setPoOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <TintTriggerRow elevated={false} tintHex={tintHex} open={poOpen} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-background-tint-popover=""
        side="bottom"
        align="start"
        className="w-[min(252px,calc(100vw-2rem))] p-3"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <TintPopoverInner
          elevated={false}
          labelMuted="text-muted-foreground"
          popoverOpen={poOpen}
          tintHex={tintHex}
          onTintColor={(hex) => onPatch({ tintColor: hex })}
          styleBlend={tintMode === "blend"}
          onStyleNormal={() => onPatch({ tintMode: "normal" })}
          onStyleBlend={() => onPatch({ tintMode: "blend" })}
          tintOpacity={tintOpacity}
          onTintOpacity={(v) => onPatch({ tintOpacity: Math.round(v) })}
          blur={blur}
          onBlur={(v) => onPatch({ blur: Math.round(v) })}
          opacitySuffix="%"
        />
      </PopoverContent>
    </Popover>
  );
}
