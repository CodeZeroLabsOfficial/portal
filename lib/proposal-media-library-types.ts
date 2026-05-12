export type ProposalLibraryAssetKind = "image" | "video" | "snippet" | "block";

export type ProposalLibraryAsset = {
  /** Full object path in the bucket (stable id). */
  id: string;
  /** File name without leading folders. */
  name: string;
  kind: ProposalLibraryAssetKind;
  /** HTTPS URL suitable for `<img src>` / `<video src>` / fetch (signed or token-based). */
  downloadUrl: string;
  /** Optional duration in seconds from object metadata (`durationSec`). */
  durationSec?: number;
};
