/**
 * Public proposal pages — centered shell with viewport-wide grouped sections (`section` blocks)
 * escaping the reading column underneath.
 */

/** Typography / imagery column shared with headings and breakout section innards (matches legacy gutters). */
export const PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES =
  "mx-auto w-full max-w-5xl px-6 sm:px-12 lg:px-20 xl:px-28";

export const PROPOSAL_PUBLIC_SHELL_CLASSES =
  "proposal-print-root w-full py-12 sm:py-14 print:py-8";

export const PROPOSAL_PUBLIC_CONTENT_CLASSES =
  `${PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES} overflow-x-hidden print:max-w-none`;

/** Horizontal escape from centered `PROPOSAL_PUBLIC_CONTENT_CLASSES`; keep inner prose inside `PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES`. */
export const PROPOSAL_SECTION_VIEWPORT_BLEED_CLASSES =
  "relative left-1/2 w-[100vw] max-w-[100vw] -translate-x-1/2 overflow-x-hidden";
