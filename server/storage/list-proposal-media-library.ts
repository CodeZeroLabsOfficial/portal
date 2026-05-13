import { list, type ListBlobResultBlob } from "@vercel/blob";
import { logError } from "@/lib/logging";
import {
  getProposalMediaLibraryPrefix,
  proposalLibraryAssetFromBlobListItem,
} from "@/lib/proposal-media-library-blob";
import type { ProposalLibraryAsset } from "@/lib/proposal-media-library-types";

/**
 * Lists blobs under {@link getProposalMediaLibraryPrefix} for the proposal builder library (Vercel Blob).
 *
 * Configure with env:
 * - `BLOB_READ_WRITE_TOKEN` (required on server)
 * - `PROPOSAL_MEDIA_LIBRARY_PREFIX` (default `proposal-media-library/`)
 * - `PROPOSAL_MEDIA_LIBRARY_MAX_FILES` (cap 20–1000, default 300)
 */
export async function listProposalMediaLibraryAssets(): Promise<ProposalLibraryAsset[]> {
  const token =
    typeof process.env.BLOB_READ_WRITE_TOKEN === "string" ? process.env.BLOB_READ_WRITE_TOKEN.trim() : "";
  if (!token) {
    logError("proposal_media_library_missing_blob_token", {});
    return [];
  }

  const prefix = getProposalMediaLibraryPrefix();
  const maxRaw = process.env.PROPOSAL_MEDIA_LIBRARY_MAX_FILES;
  const maxFiles = Math.min(1000, Math.max(20, Number(maxRaw) || 300));

  const collected: ListBlobResultBlob[] = [];
  let cursor: string | undefined;

  try {
    while (collected.length < maxFiles) {
      const page = await list({
        prefix,
        token,
        limit: Math.min(500, maxFiles - collected.length),
        cursor,
      });
      collected.push(...page.blobs);
      if (!page.hasMore || !page.cursor) break;
      cursor = page.cursor;
    }
  } catch (error) {
    logError("proposal_media_library_list_failed", {
      message: error instanceof Error ? error.message : "unknown",
      prefix,
    });
    return [];
  }

  const assets: ProposalLibraryAsset[] = [];
  for (const blob of collected) {
    const asset = proposalLibraryAssetFromBlobListItem(blob, prefix);
    if (asset) assets.push(asset);
  }
  return assets;
}
