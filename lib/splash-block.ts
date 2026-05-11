import type { CSSProperties } from "react";
import { readableForeground } from "@/lib/block-style";
import { embedVideoSrc } from "@/components/proposal/embed-video";
import type { SplashBlock, SplashBlockBackground, SplashBlockHeight } from "@/types/proposal";

const DEFAULT_BEACH =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80";

export function defaultSplashBackground(): SplashBlockBackground {
  return {
    type: "image",
    url: DEFAULT_BEACH,
    focalPoint: { x: 50, y: 50 },
    tintColor: "#000000",
    tintOpacity: 38,
    tintMode: "normal",
    blur: 0,
  };
}

export function mergeSplashBackground(prev: SplashBlockBackground | undefined): SplashBlockBackground {
  const d = defaultSplashBackground();
  if (!prev) return d;
  return {
    ...d,
    ...prev,
    focalPoint: prev.focalPoint ?? d.focalPoint,
  };
}

export function splashHeightMinStyle(height: SplashBlockHeight | undefined): CSSProperties {
  const h = height ?? "half";
  if (h === "full") return { minHeight: "min(100svh, 900px)" };
  if (h === "half") return { minHeight: "50vh" };
  if (h === "third") return { minHeight: "33vh" };
  const n = Math.max(120, Math.min(2400, Math.round(h.custom)));
  return { minHeight: `${n}${h.unit}` };
}

export interface ResolvedSplashBackdrop {
  kind: "image" | "video" | "color";
  imageUrl: string;
  videoUrl: string;
  colorHex: string;
  /** YouTube / Vimeo iframe src when videoUrl is embeddable. */
  embedSrc: string | null;
  /** Direct file / non-embed video */
  isDirectVideo: boolean;
  objectPosition: string;
  tintColorHex: string;
  tintOpacityPct: number;
  tintMode: "normal" | "blend";
  blur: number;
  posterUrl: string;
  prefersLightForeground: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeCssHex(input?: string): string | null {
  if (!input || typeof input !== "string") return null;
  const v = input.trim();
  if (!v) return null;
  const raw = v.replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.split("") as [string, string, string];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return null;
}

function youtubeBackgroundSrc(pageUrl: string): string | null {
  const emb = embedVideoSrc(pageUrl);
  if (!emb || emb.kind === "iframe") return null;
  const base = emb.src;
  try {
    const u = new URL(base);
    if (emb.kind === "youtube") {
      const id = u.pathname.split("/").pop() ?? "";
      if (!id) return null;
      u.searchParams.set("autoplay", "1");
      u.searchParams.set("mute", "1");
      u.searchParams.set("controls", "0");
      u.searchParams.set("playsinline", "1");
      u.searchParams.set("rel", "0");
      u.searchParams.set("modestbranding", "1");
      u.searchParams.set("showinfo", "0");
      u.searchParams.set("fs", "0");
      u.searchParams.set("disablekb", "1");
      u.searchParams.set("iv_load_policy", "3");
      u.searchParams.set("loop", "1");
      u.searchParams.set("playlist", id);
      return u.toString();
    }
    if (emb.kind === "vimeo") {
      u.searchParams.set("autoplay", "1");
      u.searchParams.set("muted", "1");
      u.searchParams.set("background", "1");
      u.searchParams.set("controls", "0");
      return u.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveSplashBackdrop(bg: SplashBlockBackground | undefined): ResolvedSplashBackdrop {
  const merged = mergeSplashBackground(bg);
  const fp = merged.focalPoint ?? { x: 50, y: 50 };
  const objectPosition = `${clamp(fp.x, 0, 100)}% ${clamp(fp.y, 0, 100)}%`;
  const tintColorHex = normalizeCssHex(merged.tintColor) ?? "#000000";
  const tintOpacityPct = clamp(Number(merged.tintOpacity ?? 35), 0, 100);
  const tintMode = merged.tintMode === "blend" ? "blend" : "normal";
  const blur = clamp(Number(merged.blur ?? 0), 0, 24);

  const kind = merged.type === "video" || merged.type === "image" ? merged.type : "color";
  const colorHex = normalizeCssHex(merged.color) ?? "#0f172a";
  const imageUrl = (merged.url ?? "").trim();
  const videoUrl = (merged.videoUrl ?? "").trim();
  const posterUrl = (merged.posterUrl ?? "").trim() || (kind === "image" ? imageUrl : "");

  let embedSrc: string | null = null;
  if (kind === "video" && videoUrl) {
    embedSrc = youtubeBackgroundSrc(videoUrl);
  }

  const isDirectVideo = kind === "video" && Boolean(videoUrl) && !embedSrc;

  let prefersLightForeground = false;
  if (kind === "image" && imageUrl) prefersLightForeground = true;
  else if (kind === "video" && videoUrl) prefersLightForeground = true;
  else prefersLightForeground = readableForeground(colorHex) === "#ffffff";

  return {
    kind,
    imageUrl,
    videoUrl,
    colorHex,
    embedSrc,
    isDirectVideo,
    objectPosition,
    tintColorHex,
    tintOpacityPct,
    tintMode,
    blur,
    posterUrl,
    prefersLightForeground,
  };
}

export function defaultSplashBlock(id: string): SplashBlock {
  return {
    id,
    type: "splash",
    background: defaultSplashBackground(),
    height: "half",
    alignment: { vertical: "center", horizontal: "center" },
    html: '<h1 style="color:#ffffff">Your proposal headline</h1><p style="color:rgba(255,255,255,0.88)">For [Client Name] on [Date]</p>',
    showCard: false,
    cardOpacity: 70,
  };
}
