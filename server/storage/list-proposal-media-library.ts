import { list } from "@vercel/blob";
import { getProposalMediaLibraryPrefix } from "@/lib/proposal-media-library-blob";
import { logError } from "@/lib/logging";
import type { ProposalLibraryAsset, ProposalLibraryAssetKind } from "@/lib/proposal-media-library-types";

function inferKind(objectPath: string): ProposalLibraryAssetKind | null {
  const base = objectPath.split("/").pop()?.toLowerCase() ?? "";
  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|tif|tiff|heic|heif)$/.test(base)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogv|mpeg|mpg|mkv)$/.test(base)) return "video";
  if (/\.(html?)$/.test(base)) return "snippet";
  if (/\.(json)$/.test(base)) return "block";
  return null;
}

function displayName(objectPath: string, prefix: string): string {
  const trimmed = objectPath.startsWith(prefix) ? objectPath.slice(prefix.length) : objectPath;
  const seg = trimmed.split("/").filter(Boolean);
  return seg[seg.length - 1] ?? objectPath;
}

/**
 * Lists media under a Vercel Blob prefix for the proposal builder library.
 *
 * Configure with env:
 * - `PROPOSAL_MEDIA_LIBRARY_PREFIX` (default `proposal-media-library/`)
 * - `BLOB_READ_WRITE_TOKEN` (Vercel Blob read/write token)
 */
export async function listProposalMediaLibraryAssets(): Promise<ProposalLibraryAsset[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    logError("proposal_media_library_missing_blob_token", {});
    return [];
  }

  const rawPrefix = getProposalMediaLibraryPrefix();
  const prefix = rawPrefix.replace(/\/?$/, "/");

  const maxRaw = process.env.PROPOSAL_MEDIA_LIBRARY_MAX_FILES;
  const maxFiles = Math.min(500, Math.max(20, Number(maxRaw) || 300));

  const raw: { pathname: string; url: string }[] = [];
  let cursor: string | undefined;

  try {
    const cap = Math.min(2000, maxFiles * 4);
    while (raw.length < cap) {
      const page = await list({
        prefix,
        cursor,
        limit: Math.min(1000, cap - raw.length),
      });
      for (const b of page.blobs) {
        raw.push({ pathname: b.pathname, url: b.url });
      }
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
  for (const blob of raw) {
    const kind = inferKind(blob.pathname);
    if (!kind) continue;
    assets.push({
      id: blob.pathname,
      name: displayName(blob.pathname, prefix),
      kind,
      downloadUrl: blob.url,
    });
    if (assets.length >= maxFiles) break;
  }

  return assets;
}
