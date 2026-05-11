import type { ProposalBlock, ProposalContentBlock } from "@/types/proposal";

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
 * Default vertical gap between siblings inside section/column stacks (after the first child). Heading → rich
 * text is slightly tighter — see `proposalSectionChildGapBefore`.
 *
 * Previously this was `mt-[100px]`, which made e.g. **text → packages** feel enormous next to **header → text**
 * (`mt-10`) inside the same section band.
 */
export const PROPOSAL_DOCUMENT_SECTION_SIBLING_GAP_CLASSES = "mt-12";

/**
 * Top margin before an item in a section or column stack (not used on the first child).
 */
export function proposalSectionChildGapBefore(prev: ProposalContentBlock, curr: ProposalContentBlock): string {
  if (prev.type === "header" && curr.type === "text") return "mt-10";
  return PROPOSAL_DOCUMENT_SECTION_SIBLING_GAP_CLASSES;
}
/**
 * Padding inside a section’s inner column (above/below stacked children).
 */
export const PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES = "py-[50px]";
/**
 * Root stack wrapper in `ProposalDocumentView`: bottom padding only (`pb-[50px]`).
 * Do **not** use `py-[50px]` here — section/column inner wrappers already use `py-[50px]` (`PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES`),
 * and stacking both made the **first** section’s heading sit ~100px below the page edge while later sections looked tighter.
 * Space **between** root blocks uses `proposalDocumentRootBlockGapBefore`.
 */
export const PROPOSAL_DOCUMENT_ROOT_STACK_GAP_CLASSES = "flex flex-col gap-0 pb-[50px]";

/**
 * Root-level header/text blocks each used to get full `py-[50px]`, which stacks to ~100px between a Heading
 * block and the following Text block. Inside a **Section** block those siblings share one padded wrapper
 * instead (`proposalSectionChildGapBefore`), so the gap looked much tighter — same blocks, different DOM.
 * `proposalDocumentRootInnerColumnVerticalPad` + `proposalDocumentRootBlockGapBefore` align root pairs with
 * section interior rhythm (`mt-10`).
 */
export function proposalDocumentRootInnerColumnVerticalPad(
  block: ProposalBlock,
  prev: ProposalBlock | undefined,
  next: ProposalBlock | undefined,
): string {
  if (block.type === "header" && next?.type === "text") return "pt-[50px] pb-0";
  if (block.type === "text" && prev?.type === "header") return "pt-0 pb-[50px]";
  return PROPOSAL_DOCUMENT_BLOCK_INNER_PAD_CLASSES;
}

/**
 * Large top margin before this root block when it should separate from the previous block — section bands,
 * and heading→text at root (matches section interior).
 */
export function proposalDocumentRootBlockGapBefore(prev: ProposalBlock, curr: ProposalBlock): string | undefined {
  if (prev.type === "splash" || curr.type === "splash") return undefined;
  if (prev.type === "section" || curr.type === "section") return "mt-[100px]";
  if (prev.type === "header" && curr.type === "text") return "mt-10";
  return undefined;
}
/** Row gap for `columns` layout in the public viewer (horizontal gap unchanged). */
export const PROPOSAL_DOCUMENT_COLUMNS_ROW_GAP_CLASSES = "gap-y-[100px]";
