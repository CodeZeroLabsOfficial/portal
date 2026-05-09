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
  `${PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES} print:max-w-none`;

/** Horizontal escape from centered `PROPOSAL_PUBLIC_CONTENT_CLASSES`; keep prose inside `PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES`. Avoid `overflow-x-hidden` on ancestors or this clip will negate full-bleed. */
export const PROPOSAL_SECTION_VIEWPORT_BLEED_CLASSES =
  "relative w-screen shrink-0 max-w-[100vw] box-border ml-[calc(50%-50vw)] mr-[calc(50%-50vw)]";
