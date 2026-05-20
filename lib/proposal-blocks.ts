import type {
  AgreementBlock,
  PackagesBlock,
  ProposalBlock,
  ProposalColumnChildBlock,
  ProposalContentBlock,
  SectionBlock,
} from "@/types/proposal";
import { isSectionBackgroundActive } from "@/lib/section-background";

function* walkNestedContent(block: ProposalContentBlock): Generator<ProposalContentBlock> {
  yield block;
  if (block.type === "columns") {
    for (const stack of block.stacks) {
      for (const c of stack) {
        yield* walkNestedContent(c as ProposalContentBlock);
      }
    }
  }
}

/** Every content-bearing block in document order, including descendants inside grouped layouts or multi-column stacks. */
export function* iterateProposalContentBlocks(blocks: ProposalBlock[]): Generator<ProposalContentBlock> {
  for (const b of blocks) {
    if (b.type === "section") {
      for (const child of b.children) {
        yield* walkNestedContent(child);
      }
    } else if (b.type === "agreement") {
      yield b as ProposalContentBlock;
      for (const child of b.children) {
        yield* walkNestedContent(child as ProposalContentBlock);
      }
    } else if (b.type === "columns") {
      yield* walkNestedContent(b);
    } else {
      yield b as ProposalContentBlock;
    }
  }
}

function findInsideColumnStack(stack: ProposalColumnChildBlock[], id: string): ProposalBlock | undefined {
  for (const c of stack) {
    const hit = findNestedContentSubtree(c as ProposalContentBlock, id);
    if (hit) return hit;
  }
  return undefined;
}

function findNestedContentSubtree(block: ProposalContentBlock, id: string): ProposalBlock | undefined {
  if (block.id === id) return block as ProposalBlock;
  if (block.type === "columns") {
    for (const stack of block.stacks) {
      const hit = findInsideColumnStack(stack, id);
      if (hit) return hit;
    }
    return undefined;
  }
  return undefined;
}

/**
 * True when the document contains at least one `agreement` block at any depth
 * (including inside sections or column stacks). Server-safe — used by the
 * public proposal page to decide whether to suppress the legacy footer
 * acceptance form.
 */
export function hasAgreementBlock(blocks: ProposalBlock[]): boolean {
  for (const b of iterateProposalContentBlocks(blocks)) {
    if (b.type === "agreement") return true;
  }
  return false;
}

/** First `agreement` block in document order (nested layouts included), or null. */
export function findFirstAgreementBlock(blocks: ProposalBlock[]): AgreementBlock | null {
  for (const b of iterateProposalContentBlocks(blocks)) {
    if (b.type === "agreement") return b as AgreementBlock;
  }
  return null;
}

/**
 * True when the last top-level block in the proposal renders as a viewport-bleed
 * band (section, splash, or packages/agreement with an active backdrop). Used by
 * the public viewer to drop redundant bottom padding when the band already runs
 * flush to the viewport edge.
 */
/** Full-bleed backdrop band in the block editor — stacks flush with siblings (no canvas gap). */
export function proposalBlockRendersFlushEditorBand(block: ProposalBlock): boolean {
  switch (block.type) {
    case "section":
      return isSectionBackgroundActive((block as SectionBlock).background);
    case "packages":
      return isSectionBackgroundActive((block as PackagesBlock).background);
    case "agreement":
      return isSectionBackgroundActive((block as AgreementBlock).background);
    case "splash":
      return true;
    default:
      return false;
  }
}

/** First top-level splash block id — used for template company logo on the public hero. */
export function firstRootSplashBlockId(blocks: ProposalBlock[]): string | null {
  const first = blocks[0];
  return first?.type === "splash" ? first.id : null;
}

export function proposalEndsInFullBleedBand(blocks: ProposalBlock[]): boolean {
  const last = blocks[blocks.length - 1];
  if (!last) return false;
  if (last.type === "section" || last.type === "splash") return true;
  if (last.type === "packages") {
    return isSectionBackgroundActive((last as PackagesBlock).background);
  }
  if (last.type === "agreement") {
    return isSectionBackgroundActive((last as AgreementBlock).background);
  }
  return false;
}

/** Depth-first search by block id (pricing, packages, and nested stacks). */
export function findProposalBlockById(blocks: ProposalBlock[], id: string): ProposalBlock | undefined {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === "section") {
      for (const c of b.children) {
        const hit = findNestedContentSubtree(c, id);
        if (hit) return hit;
      }
    }
    if (b.type === "agreement") {
      for (const c of b.children) {
        const hit = findNestedContentSubtree(c as ProposalContentBlock, id);
        if (hit) return hit;
      }
    }
    if (b.type === "columns") {
      for (const stack of b.stacks) {
        const inner = findInsideColumnStack(stack, id);
        if (inner) return inner;
      }
    }
  }
  return undefined;
}
