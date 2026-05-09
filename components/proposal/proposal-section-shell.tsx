"use client";

import { cn } from "@/lib/utils";
import { withAlpha } from "@/lib/block-style";
import {
  resolveSectionBackground,
  sectionPrefersLightForeground,
  type ResolvedSectionBackground,
} from "@/lib/section-background";
import type { SectionBackground } from "@/types/proposal";

/** Backdrop visuals shared by proposal preview and proposal editor canvases. */
export function ProposalSectionShell({
  background,
  variant = "viewer",
  viewportBleed = false,
  children,
}: {
  background?: SectionBackground;
  variant?: "viewer" | "editor";
  /** Public viewer edge-to-edge band; horizontal padding stays on constrained inner children */
  viewportBleed?: boolean;
  children: React.ReactNode;
}) {
  const resolved = resolveSectionBackground(background);

  if (!resolved.active) {
    return children;
  }

  const prefersLight = sectionPrefersLightForeground(resolved);
  const viewerEdge = viewportBleed && variant === "viewer";
  const shellRadius =
    variant === "editor" ? cn("rounded-xl") : viewerEdge ? "rounded-none" : cn("rounded-3xl md:rounded-[1.85rem]");
  const gutter =
    variant === "editor"
      ? cn("px-4 py-6 sm:px-5 sm:py-8")
      : viewerEdge
        ? cn("px-0 py-10 sm:py-14 md:py-16")
        : cn("px-6 py-10 sm:px-10 sm:py-14 md:px-14 md:py-16");
  const surfaceChrome = viewerEdge
    ? "shadow-none ring-0 border-y border-black/[0.07] dark:border-white/[0.08]"
    : "shadow-lg ring-1 ring-black/[0.08] dark:ring-white/10";

  return (
    <div
      className={cn(
        "proposal-section-shell relative isolate min-h-[220px] w-full overflow-hidden",
        surfaceChrome,
        shellRadius,
        prefersLight &&
          cn(
            "text-white [&_h2]:!text-white",
            "[&_.proposal-rich-text]:!text-white/[0.9] [&_.proposal-rich-text_a]:text-sky-200 [&_.proposal-rich-text_a]:underline-offset-4",
            "[&_.text-muted-foreground]:text-white/72",
          ),
      )}
    >
      <SectionBackdropLayers resolved={resolved} />

      <div className={cn("relative z-10", gutter)}>
        {resolved.contentCard ? (
          <div
            className={cn(
              "backdrop-blur-md",
              prefersLight
                ? "rounded-2xl border border-white/15 bg-black/36 p-5 shadow-inner sm:p-8 md:p-10"
                : "rounded-2xl border border-border/60 bg-card/92 p-5 shadow-inner sm:p-8 md:p-10",
            )}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function SectionBackdropLayers({ resolved }: { resolved: ResolvedSectionBackground }) {
  const blurPx = resolved.blurStrength;
  const filter = blurPx > 0 ? `blur(${blurPx}px)` : undefined;
  const scale = blurPx > 0 ? 1.1 : undefined;
  const tintAlpha = resolved.tintOpacityPct / 100;

  const tintFill =
    resolved.tintStyle === "blend"
      ? ({
          mixBlendMode: "soft-light" as const,
          backgroundColor: withAlpha(resolved.tintColorHex, Math.min(1, tintAlpha * 1.2)),
        })
      : { backgroundColor: withAlpha(resolved.tintColorHex, tintAlpha) };

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-neutral-950">
      {/* Media */}
      <div
        className="absolute inset-0"
        style={{ filter, transform: scale ? `scale(${scale})` : undefined }}
      >
        {resolved.kind === "color" ? (
          <div className="h-full w-full" style={{ backgroundColor: resolved.colorHex }} />
        ) : resolved.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolved.mediaUrl}
            alt=""
            className="h-full w-full max-w-none select-none object-cover"
            draggable={false}
          />
        ) : (
          <video
            key={resolved.mediaUrl}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            src={resolved.mediaUrl || undefined}
          />
        )}
      </div>

      {/* Tint */}
      <div className={cn("absolute inset-0", resolved.tintStyle === "blend" && "isolate")}>
        <div className={cn("absolute inset-0", resolved.tintStyle === "blend" && "isolate")} style={tintFill} />
      </div>
    </div>
  );
}
