"use client";

import * as React from "react";

/** Set by `ProposalSectionShell` in the editor so nested controls match the section fill. */
export const ProposalSectionEditorChromeContext = React.createContext<{
  seamless: boolean;
  /** From `sectionPrefersLightForeground` — light text on dark fill */
  prefersLight: boolean;
} | null>(null);

export function useProposalSectionEditorChrome() {
  return React.useContext(ProposalSectionEditorChromeContext);
}
