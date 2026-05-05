"use client";

import dynamic from "next/dynamic";
import type { ProposalDocumentEditorProps } from "@/components/proposal/proposal-document-editor";

function ProposalDocumentEditorLoading() {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-12 text-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  );
}

/** Client-only load of the proposal builder (TipTap + dnd-kit) to avoid SSR/bundle issues. */
export const ProposalDocumentEditorLazy = dynamic<ProposalDocumentEditorProps>(
  () => import("./proposal-document-editor").then((m) => m.ProposalDocumentEditor),
  {
    ssr: false,
    loading: ProposalDocumentEditorLoading,
  },
);
