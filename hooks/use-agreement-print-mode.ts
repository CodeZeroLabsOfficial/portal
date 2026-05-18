"use client";

import * as React from "react";

/** Applied to `document.body` while printing an agreement modal (see `app/globals.css`). */
export const AGREEMENT_PRINT_BODY_CLASS = "agreement-print-mode";

/** Marks the scrollable agreement document inside the modal — only this region is printed. */
export const AGREEMENT_PRINT_TARGET_ATTR = "data-agreement-print-target";

/**
 * Isolates the agreement document for `window.print()`:
 * hides the rest of the page and removes modal chrome via print CSS.
 */
export function useAgreementPrintMode() {
  React.useEffect(() => {
    function onBeforePrint() {
      document.body.classList.add(AGREEMENT_PRINT_BODY_CLASS);
    }
    function onAfterPrint() {
      document.body.classList.remove(AGREEMENT_PRINT_BODY_CLASS);
    }
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      document.body.classList.remove(AGREEMENT_PRINT_BODY_CLASS);
    };
  }, []);
}

export function printAgreementDocument() {
  document.body.classList.add(AGREEMENT_PRINT_BODY_CLASS);
  window.print();
}
