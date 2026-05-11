import type { ProposalBlock } from "@/types/proposal";

/**
 * Public proposal pages — vertical shell spacing + a centered reading column utility.
 * Proposal document chrome applies `PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES` to the optional logo,
 * non-section roots, gates, and footers; grouped `section` blocks span `w-full` edge-to-edge.
 */

/** Typography / imagery column (logo, stray root blocks, footers). */
export const PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES =
  "mx-auto w-full max-w-5xl px-6 sm:px-12 lg:px-20 xl:px-28";

export const PROPOSAL_PUBLIC_SHELL_CLASSES =
  "proposal-print-root w-full py-12 sm:py-14 print:py-8";

/** Narrow column wrapper for password gate & footers beside the unconstrained proposal body */
export const PROPOSAL_PUBLIC_CONTENT_CLASSES =
  `${PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES} print:max-w-none`;

/** Proposal body fills the horizontal track of `<main>`; do not nest inside `PROPOSAL_PUBLIC_CONTENT_CLASSES`. */
export const PROPOSAL_PUBLIC_DOCUMENT_OUTER_CLASSES = "w-full print:max-w-none";

/**
 * Break a block out of `PROPOSAL_PUBLIC_INNER_COLUMN_CLASSES` to the viewport width — same horizontal band as
 * `ProposalSectionShell` with `viewportBleed` (section backgrounds).
 */
export const PROPOSAL_PUBLIC_VIEWPORT_BREAKOUT_CLASSES =
  "relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 print:w-full print:max-w-none print:translate-x-0 print:left-0";

/**
 * Vertical rhythm between sibling proposal blocks (root, inside sections, column stacks).
 */
export const PROPOSAL_DOCUMENT_BLOCK_STACK_CLASSES = "space-y-[100px]";
/**
 * Padding inside a section’s inner column (above/below stacked children).
 */
export const PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES = "py-[50px]";
/**
 * Root stack wrapper in `ProposalDocumentView`: vertical document padding only. Space **between** root
 * blocks uses `proposalDocumentRootBlockGapBefore` on each item after the first (section-adjacent only).
 */
export const PROPOSAL_DOCUMENT_ROOT_STACK_GAP_CLASSES = "flex flex-col gap-0 py-[50px]";

/**
 * Large top margin before this root block when it should separate from the previous block — only when a
 * root **section** band is involved, and never next to **splash** (hero stays flush to following content).
 */
export function proposalDocumentRootBlockGapBefore(prev: ProposalBlock, curr: ProposalBlock): string | undefined {
  if (prev.type === "splash" || curr.type === "splash") return undefined;
  if (prev.type === "section" || curr.type === "section") return "mt-[100px]";
  return undefined;
}
/** Row gap for `columns` layout in the public viewer (horizontal gap unchanged). */
export const PROPOSAL_DOCUMENT_COLUMNS_ROW_GAP_CLASSES = "gap-y-[100px]";
