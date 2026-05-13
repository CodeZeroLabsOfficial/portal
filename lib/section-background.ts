import { readableForeground } from "@/lib/block-style";
import type { SectionBackground } from "@/types/proposal";

/** Apply partial updates atop existing or authored defaults for the picker. */
export function mergeSectionBackground(
  prev: SectionBackground | undefined,
  patch: Partial<SectionBackground>,
): SectionBackground {
  const base = prev ?? defaultSectionBackground();
  return { ...base, ...patch, kind: patch.kind ?? base.kind };
}

/** Persisted defaults when the author first opens section background controls. */
export function defaultSectionBackground(): SectionBackground {
  return {
    kind: "color",
    color: "#0f172a",
    tintColor: "#000000",
    tintStyle: "normal",
    tintOpacity: 16,
    blurStrength: 0,
    contentCard: false,
  };
}

export interface ResolvedSectionBackground {
  active: boolean;
  kind: "color" | "image" | "video";
  colorHex: string;
  mediaUrl: string;
  /** Trimmed poster / mobile fallback image when `kind` is `video`. */
  posterUrl: string;
  tintColorHex: string;
  tintStyle: "normal" | "blend";
  /** 0–100 */
  tintOpacityPct: number;
  /** UI value 0–24; applied as Gaussian blur px on media layer only. */
  blurStrength: number;
  contentCard: boolean;
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

/** True when persisted background should influence layout (omit for legacy sections). */
export function isSectionBackgroundActive(bg?: SectionBackground): boolean {
  if (!bg || !bg.kind) return false;
  if (bg.kind === "color") {
    const c = normalizeCssHex(bg.color) ?? bg.color?.trim();
    return Boolean(c);
  }
  return Boolean(bg.mediaUrl && bg.mediaUrl.trim().length > 0);
}

export function resolveSectionBackground(bg?: SectionBackground): ResolvedSectionBackground {
  const d = defaultSectionBackground();
  if (!bg) {
    return {
      active: false,
      kind: "color",
      colorHex: d.color ?? "#0f172a",
      mediaUrl: "",
      posterUrl: "",
      tintColorHex: normalizeCssHex(d.tintColor) ?? "#000000",
      tintStyle: d.tintStyle ?? "normal",
      tintOpacityPct: clamp(Number(d.tintOpacity ?? 16), 0, 100),
      blurStrength: clamp(Number(d.blurStrength ?? 0), 0, 24),
      contentCard: Boolean(d.contentCard),
    };
  }

  const kind = bg.kind === "image" || bg.kind === "video" ? bg.kind : "color";
  const colorHex = normalizeCssHex(bg.color) ?? normalizeCssHex(d.color) ?? "#0f172a";
  const mediaUrl = (bg.mediaUrl ?? "").trim();
  const posterUrl = kind === "video" ? (bg.posterUrl ?? "").trim() : "";
  const tintColorHex = normalizeCssHex(bg.tintColor) ?? "#000000";
  const tintStyle = bg.tintStyle === "blend" ? "blend" : "normal";
  const tintOpacityPct = clamp(Number(bg.tintOpacity ?? d.tintOpacity ?? 16), 0, 100);
  const blurStrength = clamp(Number(bg.blurStrength ?? d.blurStrength ?? 0), 0, 24);
  const contentCard = Boolean(bg.contentCard);

  const active = isSectionBackgroundActive(bg);

  return {
    active,
    kind,
    colorHex,
    mediaUrl,
    posterUrl,
    tintColorHex,
    tintStyle,
    tintOpacityPct,
    blurStrength,
    contentCard,
  };
}

/** Light copy on tinted media/heavy fills; editorial dark otherwise. */
export function sectionPrefersLightForeground(resolved: ResolvedSectionBackground): boolean {
  if (!resolved.active) return false;
  if (resolved.kind === "video" || resolved.kind === "image") return true;
  const fg = readableForeground(resolved.colorHex);
  return fg === "#ffffff";
}
