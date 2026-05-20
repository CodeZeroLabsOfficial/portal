"use client";

import * as React from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProposalMediaLibraryOptional } from "@/components/proposal/proposal-media-library";
import type { ProposalBranding } from "@/types/proposal";
import { cn } from "@/lib/utils";

export interface ProposalTemplateBrandingPanelProps {
  branding: ProposalBranding | undefined;
  onChange: (next: ProposalBranding | undefined) => void;
  disabled?: boolean;
  className?: string;
}

export function ProposalTemplateBrandingPanel({
  branding,
  onChange,
  disabled = false,
  className,
}: ProposalTemplateBrandingPanelProps) {
  const mediaLibrary = useProposalMediaLibraryOptional();
  const logoUrl = branding?.logoUrl?.trim() ?? "";

  function setLogoUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
      const next = { ...branding };
      delete next.logoUrl;
      const keys = Object.keys(next).filter((k) => (next as ProposalBranding)[k as keyof ProposalBranding] != null);
      onChange(keys.length > 0 ? next : undefined);
      return;
    }
    onChange({ ...branding, logoUrl: trimmed });
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-border/70 bg-muted/15 px-4 py-3",
        className,
      )}
      aria-labelledby="proposal-template-branding-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2
            id="proposal-template-branding-heading"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Branding
          </h2>
          <p className="text-sm text-muted-foreground">
            Company logo appears on the first splash block when recipients open the proposal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mediaLibrary ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={disabled}
              onClick={() => {
                mediaLibrary.openSelection({
                  allowedKinds: ["image"],
                  onSelect: (asset) => {
                    if (asset.kind !== "image") return;
                    setLogoUrl(asset.downloadUrl);
                  },
                });
              }}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Upload or library
            </Button>
          ) : null}
          {logoUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              disabled={disabled}
              onClick={() => setLogoUrl("")}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div
          className={cn(
            "flex h-14 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/80 bg-background/80",
            logoUrl && "border-solid",
          )}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="max-h-10 max-w-[6.5rem] object-contain px-2" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground/70" aria-hidden />
          )}
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="proposal-branding-logo-url" className="text-[11px] text-muted-foreground">
            Company logo URL
          </Label>
          <input
            id="proposal-branding-logo-url"
            type="url"
            value={logoUrl}
            disabled={disabled}
            placeholder="https://… or choose from library"
            spellCheck={false}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-xs shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </section>
  );
}
