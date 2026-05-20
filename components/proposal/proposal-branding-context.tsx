"use client";

import * as React from "react";
import type { ProposalBranding } from "@/types/proposal";

export type ProposalBrandingContextValue = {
  branding: ProposalBranding | undefined;
  /** First top-level splash id — company logo renders there when set. */
  firstRootSplashBlockId: string | null;
  /** Template editor — persist logo URL on save. Omitted on CRM proposals (snapshot only). */
  onBrandingChange?: (next: ProposalBranding | undefined) => void;
};

const ProposalBrandingContext = React.createContext<ProposalBrandingContextValue | null>(null);

export function ProposalBrandingProvider({
  value,
  children,
}: {
  value: ProposalBrandingContextValue;
  children: React.ReactNode;
}) {
  return <ProposalBrandingContext.Provider value={value}>{children}</ProposalBrandingContext.Provider>;
}

export function useProposalBrandingOptional(): ProposalBrandingContextValue | null {
  return React.useContext(ProposalBrandingContext);
}

/** Logo URL when this splash block should show company branding. */
export function useSplashCompanyLogoUrl(blockId: string): string | null {
  const ctx = useProposalBrandingOptional();
  if (!ctx?.branding?.logoUrl?.trim() || !ctx.firstRootSplashBlockId) return null;
  if (ctx.firstRootSplashBlockId !== blockId) return null;
  return ctx.branding.logoUrl.trim();
}

export function useSplashBackgroundPickerBranding(blockId: string) {
  const ctx = useProposalBrandingOptional();
  return {
    hasCompanyLogo: Boolean(ctx?.branding?.logoUrl?.trim()),
    isFirstRootSplash: ctx?.firstRootSplashBlockId === blockId,
  };
}
