import type {
  ProposalBlock,
  ProposalColumnChildBlock,
  ProposalContentBlock,
  ProposalDocument,
} from "@/types/proposal";

/**
 * Firestore cannot store arrays whose elements are arrays. Column layouts use
 * `stacks: Block[][]` in app memory — encode to `[{ blocks: Block[] }, …]`
 * only at persistence boundaries.
 */
function encodeBlockForFirestore(
  block: ProposalBlock | ProposalContentBlock | ProposalColumnChildBlock,
): unknown {
  if (block.type === "columns") {
    return {
      ...block,
      stacks: block.stacks.map((stack) => ({
        blocks: stack.map((inner) => encodeBlockForFirestore(inner)),
      })),
    };
  }
  if (block.type === "section") {
    return {
      ...block,
      children: block.children.map((child) => encodeBlockForFirestore(child)),
    };
  }
  return block;
}

/** Returns a plain JSON tree safe for Firestore `set` / `update` on `document`. */
export function encodeProposalDocumentForFirestore(doc: ProposalDocument): Record<string, unknown> {
  return {
    title: doc.title,
    blocks: doc.blocks.map((b) => encodeBlockForFirestore(b)),
  };
}
