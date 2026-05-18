"use client";

import * as React from "react";

/** Applied to `document.body` while printing an agreement modal (see `app/globals.css`). */
export const AGREEMENT_PRINT_BODY_CLASS = "agreement-print-mode";

/** Marks the Services Agreement body printed from the modal (title, intro, legal — not proposal UI). */
export const AGREEMENT_PRINT_TARGET_ATTR = "data-agreement-print-target";

/** Descendants excluded from agreement PDF/print even when inside the print target. */
export const AGREEMENT_PRINT_EXCLUDE_ATTR = "data-agreement-print-exclude";

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

export function printAgreementDocument(options?: { documentTitle?: string }) {
  const previousTitle = document.title;
  const nextTitle = options?.documentTitle?.trim();
  if (nextTitle) {
    document.title = nextTitle;
  }
  document.body.classList.add(AGREEMENT_PRINT_BODY_CLASS);

  function restoreTitle() {
    if (nextTitle) {
      document.title = previousTitle;
    }
    window.removeEventListener("afterprint", restoreTitle);
  }
  window.addEventListener("afterprint", restoreTitle);
  window.print();
}
