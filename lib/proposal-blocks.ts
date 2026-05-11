import type { ProposalBlock, ProposalColumnChildBlock, ProposalContentBlock } from "@/types/proposal";

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
    if (b.type === "columns") {
      const inner = findInsideColumnStack(b.stacks.flat(), id);
      if (inner) return inner;
    }
  }
  return undefined;
}
