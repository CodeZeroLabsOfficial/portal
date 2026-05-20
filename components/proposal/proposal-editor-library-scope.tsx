"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Positioning root for proposal/contract library panels. Panels use `absolute` (not
 * viewport `fixed`) so slide animations stay clipped to the proposal builder column.
 */
/** `3rem` matches workspace top bar `h-12`; `+2rem` matches main column top padding (`py-8`). */
export const PROPOSAL_EDITOR_LIBRARY_SCOPE_CLASS =
  "proposal-editor-library-scope relative isolate w-full min-h-[calc(100dvh-3rem)] overflow-x-clip";

/** Cap panel height to the visible main column (header + main inset), not full document height. */
export const PROPOSAL_EDITOR_LIBRARY_VIEWPORT_HEIGHT_CLASS =
  "h-[calc(100dvh-5rem)] max-h-[calc(100dvh-5rem)]";

/** Dimmed editor canvas behind library panels (frosted scrim). */
export const PROPOSAL_EDITOR_LIBRARY_BACKDROP_CLASS =
  "absolute inset-0 z-[80] bg-black/40 backdrop-blur-md supports-[backdrop-filter]:bg-black/30";

/** Library / Explore media sidebar and contract-template sidebar shell. */
export const PROPOSAL_EDITOR_LIBRARY_ASIDE_CLASS =
  `absolute left-0 top-0 z-[90] flex ${PROPOSAL_EDITOR_LIBRARY_VIEWPORT_HEIGHT_CLASS} w-[min(100%,380px)] flex-col overflow-hidden border-r border-border/80 bg-background/85 shadow-2xl backdrop-blur-md supports-[backdrop-filter]:bg-background/70`;

/** Chevron tab on the right edge of a library aside. */
export const PROPOSAL_EDITOR_LIBRARY_CLOSE_HANDLE_CLASS =
  "absolute -right-3 top-1/2 z-[1] flex h-14 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border/80 bg-background/85 text-muted-foreground shadow-md backdrop-blur-md transition-colors supports-[backdrop-filter]:bg-background/70 hover:bg-muted/80";

export function ProposalEditorLibraryScope({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(PROPOSAL_EDITOR_LIBRARY_SCOPE_CLASS, className)}>{children}</div>;
}
