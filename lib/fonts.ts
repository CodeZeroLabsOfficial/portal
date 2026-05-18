/**
 * Shared fonts for the portal shell and proposal/contract rich text.
 *
 * - App UI: Inter + Poppins via `next/font` (`inter`, `poppins`, `APP_SHELL_FONT_CLASS`)
 * - Proposal picker: `PROPOSAL_FONT_MENU_SECTIONS` (built from `GOOGLE_FONT_DEFS`)
 * - Proposal Google Fonts CSS: `PROPOSAL_GOOGLE_FONTS_STYLESHEET_HREF`
 */

import { Inter, Poppins } from "next/font/google";

// ---------------------------------------------------------------------------
// App shell (next/font — self-hosted, used by Tailwind `font-sans` + brand)
// ---------------------------------------------------------------------------

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

/** Apply on `<body>` in root layout. */
export const APP_SHELL_FONT_CLASS = `${inter.variable} ${poppins.variable}`;

export const BRAND_FONT_FAMILY = "Poppins";

/** Loaded via next/font; omitted from the Google Fonts stylesheet. */
const APP_SHELL_GOOGLE_FAMILIES = new Set<string>(["Inter", BRAND_FONT_FAMILY]);

// ---------------------------------------------------------------------------
// Google Fonts registry (single source — picker + stylesheet)
// ---------------------------------------------------------------------------

type FontStackKind = "sans" | "serif" | "mono";

type GoogleFontDef = {
  readonly name: string;
  readonly kind: FontStackKind;
};

const GOOGLE_FONT_DEFS: readonly GoogleFontDef[] = [
  { name: "Roboto", kind: "sans" },
  { name: "Open Sans", kind: "sans" },
  { name: "Inter", kind: "sans" },
  { name: "Montserrat", kind: "sans" },
  { name: "Poppins", kind: "sans" },
  { name: "Noto Sans JP", kind: "sans" },
  { name: "Lato", kind: "sans" },
  { name: "Arimo", kind: "sans" },
  { name: "Roboto Condensed", kind: "sans" },
  { name: "Roboto Mono", kind: "mono" },
  { name: "Oswald", kind: "sans" },
  { name: "Noto Sans", kind: "sans" },
  { name: "Raleway", kind: "sans" },
  { name: "Nunito", kind: "sans" },
  { name: "Playfair Display", kind: "serif" },
  { name: "DM Sans", kind: "sans" },
  { name: "Nunito Sans", kind: "sans" },
  { name: "Rubik", kind: "sans" },
  { name: "Roboto Slab", kind: "serif" },
];

const SANS_FALLBACK = "ui-sans-serif, system-ui, -apple-system, sans-serif";
const SERIF_FALLBACK = "ui-serif, Georgia, serif";
const MONO_FALLBACK = "ui-monospace, monospace";

function fontStack(family: string, kind: FontStackKind): string {
  const fallback =
    kind === "serif" ? SERIF_FALLBACK : kind === "mono" ? MONO_FALLBACK : SANS_FALLBACK;
  return `${family}, ${fallback}`;
}

function googleFontPickerItem(def: GoogleFontDef): ProposalFontOption {
  return { label: def.name, value: fontStack(def.name, def.kind) };
}

const GOOGLE_FONT_PICKER_ITEMS: ProposalFontOption[] = GOOGLE_FONT_DEFS.map(googleFontPickerItem);

function buildProposalGoogleFontsStylesheetHref(): string {
  const familyParams = GOOGLE_FONT_DEFS.filter((d) => !APP_SHELL_GOOGLE_FAMILIES.has(d.name))
    .map((d) => {
      const id = d.name.replace(/\s+/g, "+");
      return `family=${id}:wght@300;400;500;600;700`;
    })
    .join("&");
  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}

export const PROPOSAL_GOOGLE_FONTS_STYLESHEET_HREF = buildProposalGoogleFontsStylesheetHref();

// ---------------------------------------------------------------------------
// Proposal rich-text font picker
// ---------------------------------------------------------------------------

export interface ProposalFontOption {
  label: string;
  /** Empty = inherit (clears TipTap `textStyle` font family). */
  value: string;
}

export interface ProposalFontMenuSection {
  id: string;
  label?: string;
  items: ProposalFontOption[];
}

export const PROPOSAL_FONT_MENU_SECTIONS: ProposalFontMenuSection[] = [
  {
    id: "primary",
    items: [
      { label: "Default", value: "" },
      {
        label: `Brand font (${BRAND_FONT_FAMILY})`,
        value: fontStack(BRAND_FONT_FAMILY, "sans"),
      },
    ],
  },
  {
    id: "google",
    label: "Google fonts",
    items: GOOGLE_FONT_PICKER_ITEMS,
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        label: "System UI",
        value:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      },
      { label: "Serif (UI)", value: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" },
      {
        label: "Monospace (UI)",
        value:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      },
    ],
  },
  {
    id: "web-safe",
    label: "Web-safe",
    items: [
      { label: "Arial", value: "Arial, Helvetica, sans-serif" },
      { label: "Helvetica Neue", value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
      { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
      { label: "Tahoma", value: "Tahoma, Verdana, Geneva, sans-serif" },
      {
        label: "Trebuchet MS",
        value: "'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', sans-serif",
      },
      { label: "Segoe UI", value: "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif" },
      { label: "Calibri", value: "Calibri, 'Segoe UI', Candara, sans-serif" },
      { label: "Cambria", value: "Cambria, Georgia, 'Times New Roman', serif" },
      { label: "Georgia", value: "Georgia, 'Times New Roman', Times, serif" },
      { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
      {
        label: "Palatino",
        value: "Palatino, 'Palatino Linotype', 'Book Antiqua', 'URW Palladio L', serif",
      },
      { label: "Garamond", value: "Garamond, 'Palatino Linotype', 'Times New Roman', serif" },
      { label: "Book Antiqua", value: "'Book Antiqua', Palatino, 'Palatino Linotype', serif" },
      {
        label: "Lucida Sans",
        value: "'Lucida Sans', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, sans-serif",
      },
      {
        label: "Century Gothic",
        value: "'Century Gothic', CenturyGothic, AppleGothic, sans-serif",
      },
      {
        label: "Franklin Gothic",
        value: "'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif",
      },
      { label: "Rockwell", value: "Rockwell, 'Rockwell Nova', 'Courier New', serif" },
      { label: "Courier New", value: "'Courier New', Courier, monospace" },
      { label: "Consolas", value: "Consolas, 'Lucida Console', Monaco, monospace" },
      { label: "Optima", value: "Optima, 'Segoe UI', Candara, Calibri, sans-serif" },
      {
        label: "Futura",
        value: "Futura, 'Trebuchet MS', 'Century Gothic', CenturyGothic, sans-serif",
      },
      { label: "Impact", value: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" },
      { label: "Brush Script MT", value: "'Brush Script MT', 'Segoe Script', cursive" },
      { label: "Copperplate", value: "Copperplate, 'Copperplate Gothic Light', fantasy" },
    ],
  },
];

export const PROPOSAL_FONT_OPTIONS: ProposalFontOption[] = PROPOSAL_FONT_MENU_SECTIONS.flatMap(
  (s) => s.items,
);

/** Font weight control in the proposal rich-text “more” menu. */
export const PROPOSAL_FONT_WEIGHT_OPTIONS: { label: string; value: string }[] = [
  { label: "Default", value: "" },
  { label: "Light", value: "300" },
  { label: "Regular", value: "400" },
  { label: "Medium", value: "500" },
  { label: "Semibold", value: "600" },
  { label: "Bold", value: "700" },
];

export function normalizeProposalFontFamily(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "";
  return s
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/\s*,\s*/g, ",")
    .trim();
}

const FONT_OPTIONS_BY_NORMALIZED = new Map<string, ProposalFontOption>(
  PROPOSAL_FONT_OPTIONS.filter((o) => o.value).map((o) => [
    normalizeProposalFontFamily(o.value),
    o,
  ] as const),
);

export function resolveProposalFontOption(raw: string | undefined): ProposalFontOption {
  const n = normalizeProposalFontFamily(raw);
  if (!n) return PROPOSAL_FONT_OPTIONS[0];
  const hit = FONT_OPTIONS_BY_NORMALIZED.get(n);
  if (hit) return hit;
  return { label: "Custom", value: (raw ?? "").trim() };
}

export function proposalFontPreviewFamily(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const first = value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first || undefined;
}
