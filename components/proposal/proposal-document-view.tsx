"use client";

import * as React from "react";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type {
  AccordionBlock,
  AgreementBlock,
  IconBlock,
  ImageBlock,
  PackagesBlock,
  ProposalBlock,
  ProposalBranding,
  ProposalContentBlock,
  ProposalCustomerSignerPrefill,
  ProposalDocument,
  ProposalPublicSelections,
  ProposalStatus,
  SectionBlock,
  SplashBlock,
  TextBlock,
} from "@/types/proposal";
import {
  PROPOSAL_COLUMNS_GRID_CLASS,
  columnFlexToGridTemplate,
  coerceColumnFlex,
  columnsBlockMdGapX,
  columnsBlockMdItemsClass,
} from "@/lib/proposal-columns";
import {
  PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES,
  PROPOSAL_DOCUMENT_COLUMNS_ROW_GAP_CLASSES,
  PROPOSAL_DOCUMENT_ROOT_STACK_GAP_CLASSES,
  PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES,
  PROPOSAL_PUBLIC_VIEWPORT_BREAKOUT_CLASSES,
} from "@/lib/proposal-public-layout";
import { escapeHtml } from "@/lib/escape-html";
import { sanitizeProposalHtml } from "@/lib/sanitize-proposal-html";
import { WORKSPACE_DETAIL_PAGE_TITLE_CLASS } from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { embedVideoSrc } from "@/components/proposal/embed-video";
import { AgreementBlockPublic } from "@/components/proposal/agreement-block-public";
import type { ProposalPublicSubscriptionUi } from "@/server/proposal/public-proposal-subscription-ui";
import { PricingBlockPublic } from "@/components/proposal/pricing-block-public";
import { PackagesBlockPublic } from "@/components/proposal/packages-block-public";
import { ProposalAccordionExpandSurface } from "@/components/proposal/proposal-accordion-expand-surface";
import { ProposalSectionShell } from "@/components/proposal/proposal-section-shell";
import { ProposalSplashBlockCanvas } from "@/components/proposal/proposal-splash-block";
import { isProposalImagePlaceholderUrl } from "@/components/proposal/proposal-image-block-editor";
import { isSectionBackgroundActive } from "@/lib/section-background";
import { firstRootSplashBlockId, proposalEndsInFullBleedBand } from "@/lib/proposal-blocks";
import { splashShowsCompanyLogo } from "@/lib/splash-branding";
import { PROPOSAL_CAPTION_PLAIN_CLASS, PROPOSAL_CAPTION_RICH_DISPLAY_CLASS } from "@/lib/proposal-inline-caption-rich-display";
import { PROPOSAL_INLINE_HEADING_RICH_DISPLAY_CLASS } from "@/lib/proposal-inline-heading-rich-display";
import { ProposalIconBlockDisplay } from "@/components/proposal/proposal-icon-block-display";
import { isPublicProposalPackageSelectionsLocked } from "@/lib/proposal-package-selection";

export interface ProposalDocumentViewProps {
  document: ProposalDocument;
  branding?: ProposalBranding;
  className?: string;
  /** Public share link only — enables saving package selection. */
  shareToken?: string;
  publicSelections?: ProposalPublicSelections;
  /** When true, root `section` bands span the full width of `<main>`; copy stays in the inner column */
  viewportSectionBleed?: boolean;
  /** Proposal lifecycle status, surfaced to the agreement block so it can render an accepted state. */
  proposalStatus?: ProposalStatus;
  /** Name of the buyer that already signed the agreement (when status is `accepted`). */
  acceptedByName?: string;
  /** E-signature image (data URL) stored on the proposal when accepted. */
  acceptedSignatureDataUrl?: string;
  acceptedAt?: number;
  /** IANA zone from Settings → Locality — agreement dates and previews use this when set. */
  localityTimeZone?: string;
  /** Prefilled subscription summary for the agreement success flow (public page only). */
  publicSubscriptionUi?: ProposalPublicSubscriptionUi | null;
  /** CRM customer name / email / company for agreement field prefill (public page when `customerId` is set). */
  customerSignerPrefill?: ProposalCustomerSignerPrefill | null;
  /** Active catalogue — recurring vs one-off add-on labels in the agreement summary. */
  catalogServices?: readonly CatalogServicePickerOption[];
}

function AccordionPublicView({ block }: { block: AccordionBlock }) {
  const accordionPanels = block.panels ?? [];
  const [openById, setOpenById] = React.useState<Record<string, boolean>>({});

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70">
      {accordionPanels.map((p, panelIdx) => {
        const open = Boolean(openById[p.id]);
        const contentId = `proposal-accordion-${block.id}-${p.id}`;
        return (
          <div key={p.id} className="border-b border-border/60 last:border-b-0">
            <button
              type="button"
              className="flex w-full cursor-pointer list-none select-none items-center justify-between gap-4 px-4 py-4 text-left text-foreground sm:px-5"
              aria-expanded={open}
              aria-controls={contentId}
              onClick={() => setOpenById((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
            >
              {(p.titleHtml ?? "").trim() ? (
                <div
                  className={cn(PROPOSAL_CAPTION_RICH_DISPLAY_CLASS, "min-w-0 flex-1 text-left")}
                  dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(p.titleHtml!) }}
                />
              ) : (
                <span className={cn("min-w-0 flex-1 text-left", PROPOSAL_CAPTION_PLAIN_CLASS)}>
                  {p.title.trim() ? p.title : "Untitled panel"}
                </span>
              )}
              <ChevronRight
                className={cn(
                  "h-5 w-5 shrink-0 text-[#673AB7] transition-transform duration-200 ease-out",
                  open && "rotate-90",
                )}
                aria-hidden
              />
            </button>
            <ProposalAccordionExpandSurface
              open={open}
              motionKey={contentId}
              id={contentId}
              data-proposal-accordion-light-surface
              className={cn(
                "w-full border-t border-border/45 bg-white px-4 py-4 text-zinc-900 sm:px-5",
                panelIdx === accordionPanels.length - 1 && "rounded-b-2xl",
              )}
            >
              {p.html?.trim() ? (
                <div
                  className={cn(
                    "proposal-rich-text max-w-none text-sm leading-relaxed text-zinc-900",
                    "[&_a]:text-cyan-700 [&_a]:underline",
                    "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0",
                  )}
                  dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(p.html) }}
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">{p.body ?? ""}</div>
              )}
            </ProposalAccordionExpandSurface>
          </div>
        );
      })}
    </div>
  );
}

interface ProposalRenderContext {
  /** Full top-level block list — used by the agreement modal to summarise selections. */
  allBlocks: ProposalBlock[];
  brandingLogoUrl?: string;
  firstRootSplashBlockId?: string | null;
  proposalTitle?: string;
  proposalStatus?: ProposalStatus;
  acceptedByName?: string;
  acceptedSignatureDataUrl?: string;
  acceptedAt?: number;
  localityTimeZone?: string;
  publicSubscriptionUi?: ProposalPublicSubscriptionUi | null;
  customerSignerPrefill?: ProposalCustomerSignerPrefill | null;
  catalogServices?: readonly CatalogServicePickerOption[];
}

function BlockView({
  block,
  shareToken,
  publicSelections,
  viewportSectionBleed,
  splashPublicPresentation,
  proposalContext,
}: {
  block: ProposalBlock | ProposalContentBlock;
  shareToken?: string;
  publicSelections?: ProposalPublicSelections;
  viewportSectionBleed?: boolean;
  /** Controls full-bleed splash chrome (matches section viewport bands). */
  splashPublicPresentation?: "editor" | "nestedColumn" | "rootFullWidth";
  proposalContext?: ProposalRenderContext;
}) {
  switch (block.type) {
    /** Grouped layouts render children sequentially with generous vertical rhythm. */
    case "section": {
      const sb = block as SectionBlock;
      const stack = sb.children.map((c) => (
        <BlockView
          key={c.id}
          block={c}
          shareToken={shareToken}
          publicSelections={publicSelections}
          viewportSectionBleed={viewportSectionBleed}
          splashPublicPresentation={
            viewportSectionBleed && c.type === "splash" ? "nestedColumn" : splashPublicPresentation
          }
          proposalContext={proposalContext}
        />
      ));
      const body = viewportSectionBleed ? (
        <div className={cn(PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES, PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES)}>
          <div className="flex flex-col">{stack}</div>
        </div>
      ) : (
        <div className={cn(PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES, PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES)}>
          <div className="flex flex-col">{stack}</div>
        </div>
      );
      return (
        <ProposalSectionShell background={sb.background} variant="viewer" viewportBleed={Boolean(viewportSectionBleed)}>
          {body}
        </ProposalSectionShell>
      );
    }
    case "splash": {
      const s = block as SplashBlock;
      const pub = s.html?.trim() ? s.html : s.body ? `<p>${escapeHtml(s.body)}</p>` : "<p></p>";
      const pres = splashPublicPresentation ?? "nestedColumn";
      const splashLogo =
        proposalContext?.brandingLogoUrl &&
        splashShowsCompanyLogo(
          s,
          proposalContext.brandingLogoUrl,
          proposalContext.firstRootSplashBlockId ?? null,
        )
          ? proposalContext.brandingLogoUrl
          : null;
      const canvas = (
        <ProposalSplashBlockCanvas
          block={s}
          mode="public"
          publicHtml={pub}
          presentation="publicEdge"
          logoUrl={splashLogo}
        />
      );
      if (pres === "nestedColumn") {
        return <div className={PROPOSAL_PUBLIC_VIEWPORT_BREAKOUT_CLASSES}>{canvas}</div>;
      }
      return canvas;
    }
    case "header":
      if (block.html?.trim()) {
        return (
          <div
            className={PROPOSAL_INLINE_HEADING_RICH_DISPLAY_CLASS}
            dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(block.html) }}
          />
        );
      }
      return (
        <h2 className={cn("scroll-mt-20", WORKSPACE_DETAIL_PAGE_TITLE_CLASS)}>
          {block.text}
        </h2>
      );
    case "text": {
      const tb = block as TextBlock;
      const editorMinStyle =
        tb.editorMinHeightPx != null && Number.isFinite(tb.editorMinHeightPx)
          ? {
              minHeight: `${Math.min(2000, Math.max(48, Math.round(tb.editorMinHeightPx)))}px`,
            }
          : undefined;
      if (block.html?.trim()) {
        return (
          <div
            style={editorMinStyle}
            className={cn(
              "proposal-rich-text max-w-none text-sm leading-relaxed text-foreground",
              "[&_a]:text-primary [&_a]:underline",
              "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
              "[&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold",
              "[&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold",
              "[&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold",
              "[&_h4]:mt-4 [&_h4]:text-base [&_h4]:font-semibold",
              "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
            )}
            dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(block.html) }}
          />
        );
      }
      return (
        <div
          style={editorMinStyle}
          className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
        >
          {block.body ?? ""}
        </div>
      );
    }
    case "image": {
      const ib = block as ImageBlock;
      if (isProposalImagePlaceholderUrl(ib.url)) {
        return null;
      }
      const align = ib.align ?? "center";
      const figAlign = cn(
        "space-y-2",
        align === "left" && "mr-auto",
        align === "center" && "mx-auto",
        align === "right" && "ml-auto",
      );
      const href = ib.href?.trim();
      const imgEl = (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ib.url} alt={ib.alt ?? ""} className="max-h-[min(70vh,520px)] w-full object-contain" />
        </>
      );
      return (
        <figure className={figAlign}>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block outline-none ring-offset-background transition-opacity hover:opacity-95 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {imgEl}
            </a>
          ) : (
            imgEl
          )}
          {ib.caption ? (
            <figcaption
              className={cn(
                "text-xs text-muted-foreground",
                align === "left" && "text-left",
                align === "center" && "text-center",
                align === "right" && "text-right",
              )}
            >
              {ib.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case "video": {
      const emb = embedVideoSrc(block.url);
      if (emb) {
        return (
          <div
            className={cn(
              "overflow-hidden rounded-xl border border-border/60 bg-black/5",
              emb.kind === "youtube" || emb.kind === "vimeo" ? "aspect-video" : "",
            )}
          >
            <iframe
              title={block.title ?? "Video"}
              src={emb.src}
              className="h-full min-h-[200px] w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        );
      }
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Open video link
        </a>
      );
    }
    case "embed": {
      const v = embedVideoSrc(block.url);
      if (v) {
        return (
          <div className="overflow-hidden rounded-xl border border-border/60 aspect-video">
            <iframe title={block.title ?? "Embed"} src={v.src} className="h-full w-full" allowFullScreen />
          </div>
        );
      }
      return (
        <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{block.title ?? "Embed"}</p>
          <a href={block.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-primary underline">
            {block.url}
          </a>
        </div>
      );
    }
    case "pricing":
      return <PricingBlockPublic block={block} />;
    case "packages": {
      const pb = block as PackagesBlock;
      const packagesInteractive =
        Boolean(shareToken) && !isPublicProposalPackageSelectionsLocked(proposalContext?.proposalStatus);
      const packagesInner = (
        <PackagesBlockPublic
          block={pb}
          shareToken={shareToken ?? ""}
          initialSelection={publicSelections?.[pb.id]}
          interactive={packagesInteractive}
        />
      );
      const backdropActive = isSectionBackgroundActive(pb.background);
      const body = (
        <div className={cn(PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES, PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES)}>
          {packagesInner}
        </div>
      );
      return (
        <ProposalSectionShell
          background={pb.background}
          variant="viewer"
          viewportBleed={Boolean(viewportSectionBleed)}
        >
          {backdropActive ? body : packagesInner}
        </ProposalSectionShell>
      );
    }
    case "form":
      return (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-foreground">{block.submitLabel ?? "Information"}</p>
          <div className="mt-4 space-y-3">
            {(block.fields ?? []).map((f) => (
              <div key={f.id}>
                <label className="text-[12px] font-medium text-muted-foreground">
                  {f.label}
                  {f.required ? <span className="text-destructive"> *</span> : null}
                </label>
                {f.fieldType === "textarea" ? (
                  <textarea
                    disabled
                    rows={3}
                    className="mt-1 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                    placeholder="Collected when you accept"
                  />
                ) : f.fieldType === "select" ? (
                  <select disabled className="mt-1 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {(f.options ?? ["Option"]).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    disabled
                    type={f.fieldType === "email" ? "email" : "text"}
                    className="mt-1 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                    placeholder="Collected when you accept"
                  />
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Form responses can be finalized together with your acceptance below.
          </p>
        </div>
      );
    case "signature":
      return (
        <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
          <p className="text-sm font-medium text-foreground">{block.title ?? "Authorization"}</p>
          {block.termsSummary ? (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{block.termsSummary}</p>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            {block.signerLabel ?? "Signatory"} — use the acceptance section at the end of this page.
          </p>
        </div>
      );
    case "agreement": {
      const ab = block as AgreementBlock;
      const agreementInner = (
        <AgreementBlockPublic
          block={ab}
          allBlocks={proposalContext?.allBlocks ?? []}
          shareToken={shareToken}
          publicSelections={publicSelections}
          proposalTitle={proposalContext?.proposalTitle}
          proposalStatus={proposalContext?.proposalStatus}
          acceptedByName={proposalContext?.acceptedByName}
          acceptedSignatureDataUrl={proposalContext?.acceptedSignatureDataUrl}
          acceptedAt={proposalContext?.acceptedAt}
          localityTimeZone={proposalContext?.localityTimeZone}
          interactive={Boolean(shareToken)}
          publicSubscriptionUi={proposalContext?.publicSubscriptionUi}
          customerSignerPrefill={proposalContext?.customerSignerPrefill}
          catalogServices={proposalContext?.catalogServices}
          renderAgreementChild={(child) => (
            <BlockView
              key={child.id}
              block={child}
              shareToken={shareToken}
              publicSelections={publicSelections}
              viewportSectionBleed={viewportSectionBleed}
              splashPublicPresentation={
                viewportSectionBleed && child.type === "splash"
                  ? "nestedColumn"
                  : splashPublicPresentation
              }
              proposalContext={proposalContext}
            />
          )}
        />
      );
      const backdropActive = isSectionBackgroundActive(ab.background);
      const body = (
        <div className={cn(PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES, PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES)}>
          {agreementInner}
        </div>
      );
      return (
        <ProposalSectionShell
          background={ab.background}
          variant="viewer"
          viewportBleed={Boolean(viewportSectionBleed)}
        >
          {backdropActive ? body : agreementInner}
        </ProposalSectionShell>
      );
    }
    case "payment":
      return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
          <p className="font-medium">{block.label ?? "Payment"}</p>
          <p className="mt-1 text-muted-foreground">Your team can connect Stripe to collect payment in a follow-up step.</p>
        </div>
      );
    case "columns": {
      const stacks = block.stacks?.length ? block.stacks : [[], []];
      const colCount = stacks.length;
      const flexRow = coerceColumnFlex(colCount, block.columnFlex);
      const gapX = columnsBlockMdGapX(block.columnGap, colCount);
      const itemsClass = columnsBlockMdItemsClass(block.rowAlign);
      const pad =
        typeof block.insetPaddingPx === "number" && Number.isFinite(block.insetPaddingPx)
          ? Math.min(64, Math.max(0, Math.round(block.insetPaddingPx)))
          : 0;
      const grid = (
        <div
          className={cn(PROPOSAL_COLUMNS_GRID_CLASS, PROPOSAL_DOCUMENT_COLUMNS_ROW_GAP_CLASSES, gapX, itemsClass)}
          style={
            {
              ["--proposal-cols" as string]: columnFlexToGridTemplate(flexRow),
            } as React.CSSProperties
          }
        >
          {stacks.map((stack, colIdx) => (
            <div key={colIdx} className="flex min-w-0 flex-col">
              {stack.map((c) => (
                <BlockView
                  key={c.id}
                  block={c}
                  shareToken={shareToken}
                  publicSelections={publicSelections}
                  viewportSectionBleed={viewportSectionBleed}
                  splashPublicPresentation={splashPublicPresentation}
                  proposalContext={proposalContext}
                />
              ))}
            </div>
          ))}
        </div>
      );
      if (pad <= 0) return grid;
      return (
        <div className="rounded-lg" style={{ padding: pad }}>
          {grid}
        </div>
      );
    }
    case "accordion": {
      return <AccordionPublicView block={block} />;
    }
    case "icon": {
      return <ProposalIconBlockDisplay block={block as IconBlock} />;
    }
    case "divider":
      return <hr className="border-border/80" />;
    case "spacer": {
      const px =
        typeof block.heightPx === "number" && Number.isFinite(block.heightPx)
          ? Math.min(2400, Math.max(1, Math.round(block.heightPx)))
          : 40;
      return <div className="w-full shrink-0" style={{ height: px }} aria-hidden />;
    }
    default:
      return null;
  }
}

export function ProposalDocumentView({
  document,
  branding,
  className,
  shareToken,
  publicSelections,
  viewportSectionBleed = true,
  proposalStatus,
  acceptedByName,
  acceptedSignatureDataUrl,
  acceptedAt,
  localityTimeZone,
  publicSubscriptionUi = null,
  customerSignerPrefill = null,
  catalogServices = [],
}: ProposalDocumentViewProps) {
  const style = React.useMemo(() => {
    if (!branding?.primaryColor && !branding?.fontFamily) return undefined;
    return {
      ...(branding?.primaryColor
        ? ({ ["--proposal-primary" as string]: branding.primaryColor } as React.CSSProperties)
        : {}),
      fontFamily: branding?.fontFamily,
    } as React.CSSProperties;
  }, [branding]);

  const splashLogoBlockId = React.useMemo(
    () => (branding?.logoUrl?.trim() && viewportSectionBleed ? firstRootSplashBlockId(document.blocks) : null),
    [branding?.logoUrl, document.blocks, viewportSectionBleed],
  );

  const showDocumentLevelLogo = Boolean(branding?.logoUrl?.trim() && !splashLogoBlockId);

  const proposalContext = React.useMemo<ProposalRenderContext>(
    () => ({
      allBlocks: document.blocks,
      brandingLogoUrl: branding?.logoUrl?.trim() || undefined,
      firstRootSplashBlockId: splashLogoBlockId,
      proposalTitle: document.title,
      proposalStatus,
      acceptedByName,
      acceptedSignatureDataUrl,
      acceptedAt,
      localityTimeZone,
      publicSubscriptionUi,
      customerSignerPrefill,
      catalogServices,
    }),
    [
      document.blocks,
      branding?.logoUrl,
      splashLogoBlockId,
      document.title,
      proposalStatus,
      acceptedByName,
      acceptedSignatureDataUrl,
      acceptedAt,
      localityTimeZone,
      publicSubscriptionUi,
      customerSignerPrefill,
      catalogServices,
    ],
  );

  /**
   * Drop the document's trailing 50px when the last block already renders as a
   * viewport-bleed band — the band's own padding carries the rhythm and the
   * extra gap would otherwise reveal a strip of page background below it.
   */
  const flushBottom = proposalEndsInFullBleedBand(document.blocks);
  const rootStackClasses = flushBottom
    ? "flex flex-col gap-0"
    : PROPOSAL_DOCUMENT_ROOT_STACK_GAP_CLASSES;

  return (
    <article
      style={style}
      className={cn("w-full space-y-0", className)}
    >
      {showDocumentLevelLogo ? (
        <div className={PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES}>
          <div className="flex justify-center pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={branding!.logoUrl} alt="" className="h-10 max-w-[200px] object-contain" />
          </div>
        </div>
      ) : null}
      {viewportSectionBleed ? (
        <div className={cn("w-full", rootStackClasses)}>
          {document.blocks.map((block) => {
            const splashRootBand = Boolean(viewportSectionBleed && block.type === "splash");
            const packagesRootBand = Boolean(
              viewportSectionBleed &&
                block.type === "packages" &&
                isSectionBackgroundActive((block as PackagesBlock).background),
            );
            const agreementRootBand = Boolean(
              viewportSectionBleed &&
                block.type === "agreement" &&
                isSectionBackgroundActive((block as AgreementBlock).background),
            );
            const child = (
              <BlockView
                block={block}
                shareToken={shareToken}
                publicSelections={publicSelections}
                viewportSectionBleed={viewportSectionBleed}
                splashPublicPresentation={
                  block.type === "splash"
                    ? viewportSectionBleed
                      ? "rootFullWidth"
                      : "nestedColumn"
                    : undefined
                }
                proposalContext={proposalContext}
              />
            );
            if (block.type === "section" || splashRootBand || packagesRootBand || agreementRootBand) {
              return (
                <section key={block.id} className="w-full shrink-0">
                  {child}
                </section>
              );
            }
            return (
              <section
                key={block.id}
                className={cn(
                  PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES,
                  PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES,
                  "shrink-0",
                )}
              >
                {child}
              </section>
            );
          })}
        </div>
      ) : (
        <div className={cn(PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES, rootStackClasses)}>
          {document.blocks.map((block) => (
            <section
              key={block.id}
              className={cn(
                "space-y-0",
                block.type !== "section" && PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES,
              )}
            >
              <BlockView
                block={block}
                shareToken={shareToken}
                publicSelections={publicSelections}
                viewportSectionBleed={false}
                splashPublicPresentation={block.type === "splash" ? "nestedColumn" : undefined}
                proposalContext={proposalContext}
              />
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
