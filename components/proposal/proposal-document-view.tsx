"use client";

import * as React from "react";
import type { ProposalBlock, ProposalBranding, ProposalDocument } from "@/types/proposal";
import { sanitizeProposalHtml } from "@/lib/sanitize-proposal-html";
import { cn } from "@/lib/utils";
import { embedVideoSrc } from "@/components/proposal/embed-video";
import { PricingBlockPublic } from "@/components/proposal/pricing-block-public";

export interface ProposalDocumentViewProps {
  document: ProposalDocument;
  branding?: ProposalBranding;
  className?: string;
}

function BlockView({ block }: { block: ProposalBlock }) {
  switch (block.type) {
    case "header":
      return (
        <h2 className="scroll-mt-20 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {block.text}
        </h2>
      );
    case "text": {
      if (block.html?.trim()) {
        return (
          <div
            className={cn(
              "proposal-rich-text max-w-none text-sm leading-relaxed text-foreground",
              "[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
            )}
            dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(block.html) }}
          />
        );
      }
      return (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {block.body ?? ""}
        </div>
      );
    }
    case "image":
      return (
        <figure className="space-y-2">
          <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.url}
              alt={block.alt ?? ""}
              className="max-h-[min(70vh,520px)] w-full object-contain"
            />
          </div>
          {block.caption ? (
            <figcaption className="text-center text-xs text-muted-foreground">{block.caption}</figcaption>
          ) : null}
        </figure>
      );
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
    case "form":
      return (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-foreground">{block.submitLabel ?? "Information"}</p>
          <div className="mt-4 space-y-3">
            {block.fields.map((f) => (
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
    case "payment":
      return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
          <p className="font-medium">{block.label ?? "Payment"}</p>
          <p className="mt-1 text-muted-foreground">Your team can connect Stripe to collect payment in a follow-up step.</p>
        </div>
      );
    case "divider":
      return <hr className="border-border/80" />;
    default:
      return null;
  }
}

export function ProposalDocumentView({ document, branding, className }: ProposalDocumentViewProps) {
  const style = React.useMemo(() => {
    if (!branding?.primaryColor && !branding?.fontFamily) return undefined;
    return {
      ...(branding?.primaryColor
        ? ({ ["--proposal-primary" as string]: branding.primaryColor } as React.CSSProperties)
        : {}),
      fontFamily: branding?.fontFamily,
    } as React.CSSProperties;
  }, [branding]);

  return (
    <article
      style={style}
      className={cn("space-y-8", className)}
    >
      {branding?.logoUrl ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branding.logoUrl} alt="" className="h-10 max-w-[200px] object-contain" />
        </div>
      ) : null}
      <header>
        <h1
          className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
          style={branding?.primaryColor ? { color: branding.primaryColor } : undefined}
        >
          {document.title}
        </h1>
      </header>
      <div className="space-y-10">
        {document.blocks.map((block) => (
          <section key={block.id} className="space-y-0">
            <BlockView block={block} />
          </section>
        ))}
      </div>
    </article>
  );
}
