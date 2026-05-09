import type { ProposalBlock, ProposalContentBlock } from "@/types/proposal";

/** Every content-bearing block in document order (top-level blocks plus each section’s children). */
export function* iterateProposalContentBlocks(blocks: ProposalBlock[]): Generator<ProposalContentBlock> {
  for (const b of blocks) {
    if (b.type === "section") {
      for (const c of b.children) {
        yield c;
      }
    } else {
      yield b as ProposalContentBlock;
    }
  }
}

/** Depth-first search by id (packages / pricing may live inside a section). */
export function findProposalBlockById(blocks: ProposalBlock[], id: string): ProposalBlock | undefined {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === "section") {
      for (const c of b.children) {
        if (c.id === id) return c;
      }
    }
  }
  return undefined;
}
