"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Positioning root for proposal/contract library panels. Panels use `absolute` (not
 * viewport `fixed`) so slide animations stay clipped to the proposal builder column.
 */
export const PROPOSAL_EDITOR_LIBRARY_SCOPE_CLASS =
  "proposal-editor-library-scope relative isolate w-full min-h-[calc(100dvh-3.5rem)] overflow-x-clip";

export const PROPOSAL_EDITOR_LIBRARY_BACKDROP_CLASS =
  "absolute inset-0 z-[80] bg-black/25 backdrop-blur-[1px]";

export const PROPOSAL_EDITOR_LIBRARY_ASIDE_CLASS =
  "absolute left-0 top-0 z-[90] flex h-full w-[min(100%,380px)] flex-col border-r border-border bg-background shadow-2xl";

export function ProposalEditorLibraryScope({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(PROPOSAL_EDITOR_LIBRARY_SCOPE_CLASS, className)}>{children}</div>;
}
