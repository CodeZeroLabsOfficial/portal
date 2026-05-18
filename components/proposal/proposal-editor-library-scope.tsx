"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fills the workspace main column below the top bar so library panels slide in from the editor edge. */
export const PROPOSAL_EDITOR_LIBRARY_SCOPE_CLASS =
  "proposal-editor-library-scope relative isolate min-h-[calc(100dvh-3.5rem)]";

export const PROPOSAL_EDITOR_LIBRARY_BACKDROP_CLASS =
  "fixed z-[80] bg-black/25 backdrop-blur-[1px]";

export const PROPOSAL_EDITOR_LIBRARY_ASIDE_CLASS =
  "fixed z-[90] flex flex-col border-r border-border bg-background shadow-2xl";

type LibraryBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ProposalEditorLibraryBoundsContextValue = {
  bounds: LibraryBounds | null;
  remeasure: () => void;
};

const ProposalEditorLibraryBoundsContext = React.createContext<ProposalEditorLibraryBoundsContextValue | null>(
  null,
);

function readBounds(el: HTMLElement): LibraryBounds {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function boundsEqual(a: LibraryBounds | null, b: LibraryBounds): boolean {
  if (!a) return false;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

export function ProposalEditorLibraryScope({ children, className }: { children: ReactNode; className?: string }) {
  const scopeRef = React.useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = React.useState<LibraryBounds | null>(null);

  const remeasure = React.useCallback(() => {
    const el = scopeRef.current;
    if (!el) return;
    const next = readBounds(el);
    setBounds((prev) => (boundsEqual(prev, next) ? prev : next));
  }, []);

  React.useLayoutEffect(() => {
    remeasure();
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [remeasure]);

  const value = React.useMemo(() => ({ bounds, remeasure }), [bounds, remeasure]);

  return (
    <ProposalEditorLibraryBoundsContext.Provider value={value}>
      <div ref={scopeRef} className={cn(PROPOSAL_EDITOR_LIBRARY_SCOPE_CLASS, className)}>
        {children}
      </div>
    </ProposalEditorLibraryBoundsContext.Provider>
  );
}

export function useProposalEditorLibraryBounds(isOpen: boolean) {
  const ctx = React.useContext(ProposalEditorLibraryBoundsContext);
  const remeasure = ctx?.remeasure;

  React.useLayoutEffect(() => {
    if (!isOpen) return;
    remeasure?.();
  }, [isOpen, remeasure]);

  return ctx?.bounds ?? null;
}

export function proposalEditorLibraryPanelStyle(bounds: LibraryBounds | null): React.CSSProperties | undefined {
  if (!bounds) return undefined;
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  };
}

export function proposalEditorLibraryAsideStyle(bounds: LibraryBounds | null): React.CSSProperties | undefined {
  if (!bounds) return undefined;
  return {
    left: bounds.left,
    top: bounds.top,
    height: bounds.height,
    width: Math.min(380, bounds.width),
  };
}
