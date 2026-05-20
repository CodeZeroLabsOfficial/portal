import type { SplashBlock } from "@/types/proposal";

export type SplashBlockAlignment = SplashBlock["alignment"];
export type SplashHorizontalAlign = SplashBlockAlignment["horizontal"];

export const SPLASH_HORIZONTAL_ALIGN_OPTIONS = [
  { id: "left" as const, label: "Left" },
  { id: "center" as const, label: "Center" },
  { id: "right" as const, label: "Right" },
] as const;

/** Headline presets that occupy the logo header band (top third). */
export const SPLASH_HEADLINE_TOP_LAYOUT_PRESET_IDS = ["tl", "tc", "tr"] as const;

const TOP_PRESET_TO_MIDDLE: Record<(typeof SPLASH_HEADLINE_TOP_LAYOUT_PRESET_IDS)[number], string> = {
  tl: "ml",
  tc: "c",
  tr: "mr",
};

/** Company logo is fixed to the top third; only horizontal placement is configurable. */
export function resolveSplashLogoHorizontal(block: SplashBlock): SplashHorizontalAlign {
  return block.logoAlignment?.horizontal ?? block.alignment?.horizontal ?? "left";
}

export function applySplashLogoHorizontal(
  block: SplashBlock,
  horizontal: SplashHorizontalAlign,
): SplashBlock {
  return {
    ...block,
    logoAlignment: { vertical: "top", horizontal },
  };
}

export function splashLogoReservesTopBand(block: SplashBlock, logoUrl: string | undefined): boolean {
  return Boolean(logoUrl?.trim() && block.showLogo !== false);
}

/** Move headline out of the top band when the logo header is active. */
export function sanitizeSplashContentAlignmentForLogo(
  block: SplashBlock,
  logoUrl: string | undefined,
): SplashBlock {
  if (!splashLogoReservesTopBand(block, logoUrl) || block.alignment.vertical !== "top") {
    return block;
  }
  return {
    ...block,
    alignment: { ...block.alignment, vertical: "center" },
  };
}

export function mapHeadlineLayoutPresetForLogo(
  presetId: string,
  logoUrl: string | undefined,
  block: SplashBlock,
): string {
  if (!splashLogoReservesTopBand(block, logoUrl)) return presetId;
  if (presetId in TOP_PRESET_TO_MIDDLE) {
    return TOP_PRESET_TO_MIDDLE[presetId as keyof typeof TOP_PRESET_TO_MIDDLE];
  }
  return presetId;
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

/** Logo header band inside the shared content rail (in-flow top third). */
export function splashLogoHeaderBandClasses(horizontal: SplashHorizontalAlign): string {
  return [
    "flex h-1/3 min-h-[4.5rem] max-h-[12rem] w-full shrink-0 items-center",
    horizontal === "left" && "justify-start",
    horizontal === "center" && "justify-center",
    horizontal === "right" && "justify-end",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Cross-axis alignment for logo + headline in one column (shared inset). */
export function splashSharedRailCrossAxisClasses(horizontal: SplashHorizontalAlign): string {
  if (horizontal === "left") return "items-start";
  if (horizontal === "right") return "items-end";
  return "items-center";
}

/** Text alignment inside the rail; overrides conflicting inline HTML in public preview. */
export function splashRailTextAlignClasses(horizontal: SplashHorizontalAlign): string {
  if (horizontal === "left") {
    return "text-left [&_h1]:!text-left [&_h2]:!text-left [&_h3]:!text-left [&_h4]:!text-left [&_p]:!text-left";
  }
  if (horizontal === "right") {
    return "text-right [&_h1]:!text-right [&_h2]:!text-right [&_h3]:!text-right [&_h4]:!text-right [&_p]:!text-right";
  }
  return "text-center [&_h1]:!text-center [&_h2]:!text-center [&_h3]:!text-center [&_h4]:!text-center [&_p]:!text-center";
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
