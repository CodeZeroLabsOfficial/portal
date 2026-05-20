import type { SplashBlock } from "@/types/proposal";

export type SplashBlockAlignment = SplashBlock["alignment"];

/** Logo position presets (no focal point — logo layer only). */
export const SPLASH_LOGO_LAYOUT_PRESETS = [
  { id: "tl", label: "Top left", vertical: "top" as const, horizontal: "left" as const },
  { id: "tc", label: "Top center", vertical: "top", horizontal: "center" },
  { id: "tr", label: "Top right", vertical: "top", horizontal: "right" },
  { id: "ml", label: "Middle left", vertical: "center", horizontal: "left" },
  { id: "c", label: "Center", vertical: "center", horizontal: "center" },
  { id: "mr", label: "Middle right", vertical: "center", horizontal: "right" },
  { id: "bl", label: "Bottom left", vertical: "bottom", horizontal: "left" },
  { id: "bc", label: "Bottom center", vertical: "bottom", horizontal: "center" },
  { id: "br", label: "Bottom right", vertical: "bottom", horizontal: "right" },
] as const;

export function resolveSplashLogoAlignment(block: SplashBlock): SplashBlockAlignment {
  return block.logoAlignment ?? block.alignment;
}

export function matchSplashLogoLayoutPresetId(block: SplashBlock): string {
  const a = resolveSplashLogoAlignment(block);
  for (const p of SPLASH_LOGO_LAYOUT_PRESETS) {
    if (p.vertical === a.vertical && p.horizontal === a.horizontal) return p.id;
  }
  return "custom";
}

export function applySplashLogoLayoutPreset(block: SplashBlock, presetId: string): SplashBlock {
  if (presetId === "custom") return block;
  const p = SPLASH_LOGO_LAYOUT_PRESETS.find((x) => x.id === presetId);
  if (!p) return block;
  return {
    ...block,
    logoAlignment: { vertical: p.vertical, horizontal: p.horizontal },
  };
}

/** Whether the splash should render the template company logo. */
export function splashShowsCompanyLogo(
  block: SplashBlock,
  logoUrl: string | undefined,
  firstRootSplashBlockId: string | null,
): boolean {
  if (!logoUrl?.trim() || !firstRootSplashBlockId || block.id !== firstRootSplashBlockId) {
    return false;
  }
  return block.showLogo !== false;
}

export function splashLogoAlignmentsMatchContent(block: SplashBlock): boolean {
  const logo = resolveSplashLogoAlignment(block);
  return logo.vertical === block.alignment.vertical && logo.horizontal === block.alignment.horizontal;
}

/** Absolute logo anchor inside the splash inner column. */
export function splashLogoAbsolutePositionClasses(alignment: SplashBlockAlignment): string {
  const { vertical, horizontal } = alignment;
  return [
    "pointer-events-none absolute z-20 flex w-auto max-w-[min(100%,22.5rem)]",
    vertical === "top" && "top-5 sm:top-6",
    vertical === "center" && "top-1/2 -translate-y-1/2",
    vertical === "bottom" && "bottom-5 sm:bottom-6",
    horizontal === "left" && "left-0 justify-start",
    horizontal === "center" && "left-1/2 -translate-x-1/2 justify-center",
    horizontal === "right" && "right-0 justify-end",
  ]
    .filter(Boolean)
    .join(" ");
}

export function splashLogoRowJustifyClasses(horizontal: SplashBlockAlignment["horizontal"]): string {
  if (horizontal === "left") return "justify-start";
  if (horizontal === "right") return "justify-end";
  return "justify-center";
}

export const SPLASH_LOGO_SIZE_OPTIONS = [
  { id: "sm" as const, label: "Small" },
  { id: "md" as const, label: "Medium" },
  { id: "lg" as const, label: "Large" },
  { id: "xl" as const, label: "Extra large" },
];

export function splashLogoSizeClasses(size: SplashBlock["logoSize"] | undefined): string {
  switch (size) {
    case "sm":
      return "h-6 w-auto max-w-[7.5rem] object-contain sm:h-7 sm:max-w-[8.5rem]";
    case "lg":
      return "h-11 w-auto max-w-[15rem] object-contain sm:h-12 sm:max-w-[17.5rem]";
    case "xl":
      return "h-14 w-auto max-w-[20rem] object-contain sm:h-16 sm:max-w-[22.5rem]";
    default:
      return "h-9 w-auto max-w-[12.5rem] object-contain sm:h-10 sm:max-w-[200px]";
  }
}

export function splashLogoSizeLabel(size: SplashBlock["logoSize"] | undefined): string {
  return SPLASH_LOGO_SIZE_OPTIONS.find((o) => o.id === (size ?? "md"))?.label ?? "Medium";
}
