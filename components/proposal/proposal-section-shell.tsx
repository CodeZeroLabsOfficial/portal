"use client";

import { cn } from "@/lib/utils";
import { withAlpha } from "@/lib/block-style";
import {
  resolveSectionBackground,
  sectionPrefersLightForeground,
  type ResolvedSectionBackground,
} from "@/lib/section-background";
import type { SectionBackground } from "@/types/proposal";
import { PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES } from "@/lib/proposal-public-layout";
import { ProposalSectionEditorChromeContext } from "@/components/proposal/proposal-section-editor-chrome";

/**
 * Re-map shadcn semantic tokens for a bright section surface. Parent routes (e.g. `portal-ui`)
 * often assume a dark canvas; without this, `text-foreground` stays light-on-light when the
 * section fill is white or mist.
 */
const LIGHT_SECTION_SURFACE =
  "[color-scheme:light] [--background:0_0%_100%] [--foreground:220_18%_13%] [--card:0_0%_100%] [--card-foreground:220_18%_13%] [--popover:0_0%_100%] [--popover-foreground:220_18%_13%] [--muted:220_20%_95%] [--muted-foreground:220_10%_44%] [--border:220_16%_88%] [--input:220_16%_88%] [--secondary:220_20%_95%] [--secondary-foreground:220_15%_18%] [--accent:220_20%_94%] [--accent-foreground:220_15%_18%] [--primary:262_52%_47%] [--primary-foreground:0_0%_100%] [--ring:262_52%_47%] [--destructive:0_72%_50%] [--destructive-foreground:210_40%_98%]";

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
  const editorCanvas = variant === "editor";
  const shellRadius = editorCanvas
    ? "rounded-none"
    : viewerEdge
      ? "rounded-none"
      : cn("rounded-3xl md:rounded-[1.85rem]");
  const gutter =
    editorCanvas
      ? cn("py-8 sm:py-10 md:py-12")
      : viewerEdge
        ? /* Vertical rhythm: section inner column padding in `ProposalDocumentView` (no inter-block margins). */
          "px-0 py-0"
        : cn("px-6 py-10 sm:px-10 sm:py-14 md:px-14 md:py-16");
  const surfaceChrome = editorCanvas
    ? "rounded-none shadow-none ring-0"
    : viewerEdge
      ? "shadow-none ring-0 border-y border-black/[0.07] dark:border-white/[0.08]"
      : prefersLight
        ? "shadow-lg ring-1 ring-black/[0.08] dark:ring-white/10"
        : "shadow-[0_2px_32px_-10px_rgba(15,23,42,0.12)] ring-1 ring-zinc-950/[0.06]";

  const inner =
    resolved.contentCard ? (
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
    );

  const shellInner = (
    <div
      {...(editorCanvas ? { "data-proposal-section-editor": "" } : {})}
      className={cn(
        "proposal-section-shell relative isolate min-h-[220px] w-full min-w-0 overflow-hidden",
        surfaceChrome,
        shellRadius,
        !prefersLight && LIGHT_SECTION_SURFACE,
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
        {editorCanvas ? (
          <div className={PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES}>{inner}</div>
        ) : (
          inner
        )}
      </div>
    </div>
  );

  if (editorCanvas) {
    return (
      <ProposalSectionEditorChromeContext.Provider value={{ seamless: true, prefersLight }}>
        {shellInner}
      </ProposalSectionEditorChromeContext.Provider>
    );
  }

  return shellInner;
}

function SectionBackdropLayers({ resolved }: { resolved: ResolvedSectionBackground }) {
  const blurPx = resolved.blurStrength;
  const filter = blurPx > 0 ? `blur(${blurPx}px)` : undefined;
  const scale = blurPx > 0 ? 1.1 : undefined;

  const showTint = resolved.kind !== "color";
  const tintAlpha = resolved.tintOpacityPct / 100;
  const tintFill = showTint
    ? resolved.tintStyle === "blend"
      ? ({
          mixBlendMode: "soft-light" as const,
          backgroundColor: withAlpha(resolved.tintColorHex, Math.min(1, tintAlpha * 1.2)),
        })
      : { backgroundColor: withAlpha(resolved.tintColorHex, tintAlpha) }
    : undefined;

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

      {showTint && tintFill ? (
        <div className={cn("absolute inset-0", resolved.tintStyle === "blend" && "isolate")}>
          <div className={cn("absolute inset-0", resolved.tintStyle === "blend" && "isolate")} style={tintFill} />
        </div>
      ) : null}
    </div>
  );
}
