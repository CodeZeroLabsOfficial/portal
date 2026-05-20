"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { withAlpha } from "@/lib/block-style";
import { sanitizeProposalHtml } from "@/lib/sanitize-proposal-html";
import type { SplashBlock } from "@/types/proposal";
import {
  mergeSplashBackground,
  resolveSplashBackdrop,
  splashHeightMinStyle,
} from "@/lib/splash-block";
import {
  resolveSplashLogoHorizontal,
  sanitizeSplashContentAlignmentForLogo,
  splashLogoHeaderBandClasses,
  splashLogoSizeClasses,
  splashRailTextAlignClasses,
  splashSharedRailCrossAxisClasses,
} from "@/lib/splash-branding";
import { PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES } from "@/lib/proposal-public-layout";

const RICH_PUBLIC =
  "proposal-rich-text max-w-none text-sm leading-relaxed [&_a]:text-sky-200 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-white/35 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/75 [&_h1]:ml-0 [&_h1]:mt-0 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:text-base [&_h4]:font-semibold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p]:ml-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_img]:max-h-32 [&_img]:rounded-lg [&_img]:object-contain";

/** `flex-col`: main axis is vertical → `justify-*` controls vertical placement. */
function columnJustifyFromVertical(v: SplashBlock["alignment"]["vertical"]): string {
  if (v === "top") return "justify-start";
  if (v === "bottom") return "justify-end";
  return "justify-center";
}

/** `flex-col` without logo: cross axis is horizontal → `items-*` controls horizontal placement. */
function columnItemsFromHorizontal(h: SplashBlock["alignment"]["horizontal"]): string {
  return splashSharedRailCrossAxisClasses(h);
}

function SplashTintLayer({
  tintColorHex,
  tintOpacityPct,
  tintMode,
}: {
  tintColorHex: string;
  tintOpacityPct: number;
  tintMode: "normal" | "blend";
}) {
  const tintAlpha = tintOpacityPct / 100;
  const tintFill =
    tintMode === "blend"
      ? ({
          mixBlendMode: "soft-light" as const,
          backgroundColor: withAlpha(tintColorHex, Math.min(1, tintAlpha * 1.2)),
        })
      : { backgroundColor: withAlpha(tintColorHex, tintAlpha) };

  return (
    <div className={cn("absolute inset-0", tintMode === "blend" && "isolate")}>
      <div className={cn("absolute inset-0", tintMode === "blend" && "isolate")} style={tintFill} />
    </div>
  );
}

function SplashMediaLayers({
  resolved,
  mode,
}: {
  resolved: ReturnType<typeof resolveSplashBackdrop>;
  mode: "editor" | "public";
}) {
  const blurPx = resolved.blur;
  const filter = blurPx > 0 ? `blur(${blurPx}px)` : undefined;
  const scale = blurPx > 0 ? 1.08 : undefined;

  if (resolved.kind === "color") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-neutral-950">
        <div className="absolute inset-0" style={{ filter, transform: scale ? `scale(${scale})` : undefined }}>
          <div className="h-full w-full" style={{ backgroundColor: resolved.colorHex }} />
        </div>
        <SplashTintLayer
          tintColorHex={resolved.tintColorHex}
          tintOpacityPct={resolved.tintOpacityPct}
          tintMode={resolved.tintMode}
        />
      </div>
    );
  }

  if (resolved.kind === "image" && resolved.imageUrl) {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-neutral-950">
        <div
          className="absolute inset-0"
          style={{ filter, transform: scale ? `scale(${scale})` : undefined }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolved.imageUrl}
            alt=""
            className="h-full w-full max-w-none select-none object-cover"
            style={{ objectPosition: resolved.objectPosition }}
            draggable={false}
          />
        </div>
        <SplashTintLayer
          tintColorHex={resolved.tintColorHex}
          tintOpacityPct={resolved.tintOpacityPct}
          tintMode={resolved.tintMode}
        />
      </div>
    );
  }

  if (resolved.kind === "video" && resolved.videoUrl) {
    const poster = resolved.posterUrl || undefined;
    const motionClass = mode === "public" ? "hidden md:block" : "block";

    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-neutral-950">
        <div
          className={cn("absolute inset-0", motionClass)}
          style={{ filter, transform: scale ? `scale(${scale})` : undefined }}
        >
          {resolved.embedSrc ? (
            <iframe
              title="Background video"
              src={resolved.embedSrc}
              className="pointer-events-none absolute left-1/2 top-1/2 h-[115%] min-h-full w-[115%] min-w-full -translate-x-1/2 -translate-y-1/2 border-0 opacity-95"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          ) : (
            <video
              key={resolved.videoUrl}
              className="h-full w-full object-cover"
              style={{ objectPosition: resolved.objectPosition }}
              autoPlay={mode === "public"}
              muted
              loop
              playsInline
              preload="metadata"
              poster={poster}
              src={resolved.videoUrl || undefined}
            />
          )}
        </div>
        {mode === "public" ? (
          <div className="absolute inset-0 md:hidden">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: resolved.objectPosition }}
                draggable={false}
              />
            ) : (
              <div className="h-full w-full bg-neutral-950" />
            )}
          </div>
        ) : null}
        <SplashTintLayer
          tintColorHex={resolved.tintColorHex}
          tintOpacityPct={resolved.tintOpacityPct}
          tintMode={resolved.tintMode}
        />
      </div>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-neutral-950">
      <div className="absolute inset-0" style={{ backgroundColor: "#0f172a" }} />
      <SplashTintLayer
        tintColorHex={resolved.tintColorHex}
        tintOpacityPct={resolved.tintOpacityPct}
        tintMode={resolved.tintMode}
      />
    </div>
  );
}

function SplashCompanyLogoMark({
  logoUrl,
  prefersLight,
  logoHorizontal,
  logoSize,
}: {
  logoUrl: string;
  prefersLight: boolean;
  logoHorizontal: ReturnType<typeof resolveSplashLogoHorizontal>;
  logoSize?: SplashBlock["logoSize"];
}) {
  const edgePad =
    logoHorizontal === "left" ? "pl-0 pr-3" : logoHorizontal === "right" ? "pl-3 pr-0" : "px-3";

  return (
    <div className={splashLogoHeaderBandClasses(logoHorizontal)}>
      <div
        className={cn(
          "shrink-0 rounded-lg py-2",
          edgePad,
          prefersLight && "bg-black/25 backdrop-blur-sm",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className={splashLogoSizeClasses(logoSize)} />
      </div>
    </div>
  );
}

export interface ProposalSplashBlockCanvasProps {
  block: SplashBlock;
  mode: "editor" | "public";
  /** Template / proposal company logo (first root splash only). */
  logoUrl?: string | null;
  /** Live TipTap surface — takes precedence over `publicHtml`. */
  children?: React.ReactNode;
  /** Published / preview HTML when `children` is not used. */
  publicHtml?: string;
  className?: string;
  /** `publicEdge` matches full-width section bands; `editor` keeps inset card chrome. */
  presentation?: "editor" | "publicEdge";
}

export function ProposalSplashBlockCanvas({
  block,
  mode,
  logoUrl,
  children,
  publicHtml,
  className,
  presentation: presentationProp,
}: ProposalSplashBlockCanvasProps) {
  const mergedBg = mergeSplashBackground(block.background);
  const resolved = resolveSplashBackdrop(mergedBg);
  const prefersLight = resolved.prefersLightForeground;
  const heightStyle = splashHeightMinStyle(block.height);
  const companyLogoUrl = logoUrl?.trim() || null;
  const contentBlock = companyLogoUrl
    ? sanitizeSplashContentAlignmentForLogo(block, companyLogoUrl)
    : block;
  const align = contentBlock.alignment ?? { vertical: "center", horizontal: "center" };
  const logoHorizontal = resolveSplashLogoHorizontal(block);
  const showCard = Boolean(block.showCard);
  const cardOpacity = Math.max(0, Math.min(100, block.cardOpacity ?? 70));

  const editorChrome = mode === "editor";
  const presentation = editorChrome ? "editor" : (presentationProp ?? "publicEdge");
  const publicEdge = presentation === "publicEdge";

  const railTextClasses = splashRailTextAlignClasses(align.horizontal);

  const inner = children ? (
    <div className={cn("w-full min-w-0", !publicEdge && "max-w-[40rem]", railTextClasses)}>
      {children}
    </div>
  ) : publicHtml?.trim() ? (
    <div
      className={cn(
        RICH_PUBLIC,
        "w-full min-w-0",
        !publicEdge && "max-w-[40rem]",
        prefersLight && "text-white/[0.92]",
        railTextClasses,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(publicHtml) }}
    />
  ) : null;

  const cardStyle =
    prefersLight
      ? {
          backgroundColor: withAlpha("#030712", cardOpacity / 100),
          borderColor: withAlpha("#ffffff", 0.12),
        }
      : {
          backgroundColor: withAlpha("#ffffff", cardOpacity / 100),
          borderColor: withAlpha("#0f172a", 0.08),
        };

  const logoMark = companyLogoUrl ? (
    <SplashCompanyLogoMark
      logoUrl={companyLogoUrl}
      prefersLight={prefersLight}
      logoHorizontal={logoHorizontal}
      logoSize={block.logoSize}
    />
  ) : null;

  const textBody =
    showCard && inner ? (
      <div
        className={cn(
          "w-full max-w-full rounded-2xl border py-6 shadow-inner backdrop-blur-md sm:py-8",
          companyLogoUrl ? "px-0" : "px-5 sm:px-8",
          prefersLight ? "text-white" : "text-foreground",
        )}
        style={cardStyle}
      >
        {inner}
      </div>
    ) : (
      inner
    );

  return (
    <div
      className={cn(
        "proposal-splash-block relative isolate w-full min-w-0 overflow-hidden",
        editorChrome
          ? "rounded-xl shadow-md ring-1 ring-black/[0.08] dark:ring-white/10"
          : publicEdge
            ? "rounded-none border-t border-black/[0.07] shadow-none ring-0 dark:border-white/[0.08]"
            : "rounded-xl ring-1 ring-black/[0.08] dark:ring-white/10",
        className,
      )}
      style={heightStyle}
    >
      <SplashMediaLayers resolved={resolved} mode={mode} />

      <div
        className={cn(
          "relative z-10 flex h-full min-h-[inherit] w-full flex-col py-10 sm:py-14 md:py-16",
          prefersLight &&
            cn(
              "[&_.proposal-rich-text]:!text-white/[0.92] [&_.proposal-rich-text_a]:text-sky-200",
              "[&_.proposal-rich-text_h1]:!text-white [&_.proposal-rich-text_h2]:!text-white",
            ),
        )}
      >
        <div
          className={cn(
            "relative flex min-h-0 w-full flex-1 flex-col",
            PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES,
          )}
        >
          {companyLogoUrl ? (
            <div
              className={cn(
                "flex min-h-0 w-full flex-1 flex-col",
                splashSharedRailCrossAxisClasses(align.horizontal),
              )}
            >
              {logoMark}
              <div
                className={cn(
                  "flex min-h-0 w-full flex-1 flex-col",
                  columnJustifyFromVertical(align.vertical),
                )}
              >
                <div className="w-full min-w-0 self-stretch">{textBody}</div>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex min-h-0 w-full flex-1 flex-col",
                columnJustifyFromVertical(align.vertical),
                columnItemsFromHorizontal(align.horizontal),
              )}
            >
              <div className="w-full min-w-0 self-stretch">{textBody}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
