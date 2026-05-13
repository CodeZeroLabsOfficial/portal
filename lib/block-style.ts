import type { BlockStyle } from "@/types/proposal";

/** Default Plans / Quote primary tone — matches the inline editor "select a colour" swatches. */
export const DEFAULT_PRIMARY_COLOR = "#673AB7";
/** Default Plans / Quote highlight tone — used for the recommended tier and totals row. */
export const DEFAULT_HIGHLIGHT_COLOR = "#673AB7";
/** Default tone for the Accept (agreement) block CTA + sign button — aligned with the brand primary. */
export const DEFAULT_AGREEMENT_BUTTON_COLOR = DEFAULT_PRIMARY_COLOR;

/** Preset swatches surfaced in the Style popover for the interactive proposal editor. */
export const STYLE_PRESET_COLORS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "#673AB7", label: "Purple" },
  { value: "#4543F7", label: "Indigo" },
  { value: "#0D0D15", label: "Charcoal" },
  { value: "#0F172A", label: "Slate" },
  { value: "#475569", label: "Steel" },
  { value: "#94A3B8", label: "Pebble" },
  { value: "#E2E8F0", label: "Mist" },
  { value: "#FFFFFF", label: "White" },
];

export interface ResolvedBlockStyle {
  variant: "visual" | "simple";
  primaryColor: string;
  highlightColor: string;
}

export function resolveBlockStyle(style?: BlockStyle): ResolvedBlockStyle {
  return {
    variant: style?.variant ?? "visual",
    primaryColor: style?.primaryColor ?? DEFAULT_PRIMARY_COLOR,
    highlightColor: style?.highlightColor ?? DEFAULT_HIGHLIGHT_COLOR,
  };
}

/** Resolves the CTA button color for an Accept (agreement) block, falling back to mint. */
export function resolveAgreementButtonColor(style?: BlockStyle): string {
  return style?.primaryColor?.trim() || DEFAULT_AGREEMENT_BUTTON_COLOR;
}

/** Parse a hex colour (`#rgb`, `#rrggbb`) into 0-255 channels. Returns null when unrecognized. */
function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  const v = input.trim().replace(/^#/, "");
  if (v.length === 3) {
    const r = parseInt(v[0] + v[0], 16);
    const g = parseInt(v[1] + v[1], 16);
    const b = parseInt(v[2] + v[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  if (v.length === 6) {
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

/** Returns "#fff" when `bg` is dark enough to need light text, otherwise "#0f172a". */
export function readableForeground(bg: string): string {
  const rgb = parseHexColor(bg);
  if (!rgb) return "#0f172a";
  /** Perceived luminance (Rec. 601 weights). */
  const lum = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return lum < 150 ? "#ffffff" : "#0f172a";
}

/** Returns `rgba(r,g,b,alpha)` for a hex colour, or the input when not parseable. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/** True when the user clicked through to set a non-default style. */
export function hasCustomStyle(style?: BlockStyle): boolean {
  if (!style) return false;
  return Boolean(style.variant || style.primaryColor || style.highlightColor);
}
