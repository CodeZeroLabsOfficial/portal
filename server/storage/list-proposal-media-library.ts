import type { File } from "@google-cloud/storage";
import { getFirebaseAdminStorage } from "@/lib/firebase/admin-app";
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

type StorageObjectMetadata = {
  metadata?: Record<string, string | undefined> | undefined;
};

async function downloadUrlFromMetadata(
  bucketName: string,
  objectPath: string,
  file: File,
  metadata: StorageObjectMetadata,
): Promise<string | null> {
  try {
    const rawToken = metadata.metadata?.firebaseStorageDownloadTokens;
    const token =
      typeof rawToken === "string"
        ? rawToken.split(",")[0]?.trim()
        : Array.isArray(rawToken)
          ? String(rawToken[0] ?? "").trim()
          : undefined;
    if (token) {
      const encoded = encodeURIComponent(objectPath);
      return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
    }
    const [signed] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365,
    });
    return signed ?? null;
  } catch (error) {
    logError("proposal_media_library_resolve_url_failed", {
      path: objectPath,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

function parseDurationSec(metadata: Record<string, unknown> | undefined): number | undefined {
  if (!metadata) return undefined;
  const raw = metadata.durationSec ?? metadata.videoDurationSec;
  if (typeof raw === "string" || typeof raw === "number") {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
}

async function mapChunked<T, R>(items: T[], chunkSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

/**
 * Lists media under a Storage prefix for the proposal builder library.
 *
 * Configure with env:
 * - `PROPOSAL_MEDIA_LIBRARY_PREFIX` (default `proposal-media-library/`)
 * - `FIREBASE_STORAGE_BUCKET` or falls back to `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
 *
 * Supports custom metadata `durationSec` on video objects for thumbnail duration labels.
 */
export async function listProposalMediaLibraryAssets(): Promise<ProposalLibraryAsset[]> {
  const storage = getFirebaseAdminStorage();
  if (!storage) {
    return [];
  }

  const bucketName =
    (typeof process.env.FIREBASE_STORAGE_BUCKET === "string" && process.env.FIREBASE_STORAGE_BUCKET.trim()) ||
    (typeof process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET === "string" &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.trim()) ||
    "";
  if (!bucketName) {
    logError("proposal_media_library_missing_bucket", {});
    return [];
  }

  const rawPrefix = process.env.PROPOSAL_MEDIA_LIBRARY_PREFIX ?? "proposal-media-library/";
  const prefix = rawPrefix.replace(/\/?$/, "/");

  const maxRaw = process.env.PROPOSAL_MEDIA_LIBRARY_MAX_FILES;
  const maxFiles = Math.min(500, Math.max(20, Number(maxRaw) || 300));

  const bucket = storage.bucket(bucketName);
  let files: File[] = [];
  try {
    const [listed] = await bucket.getFiles({ prefix, maxResults: maxFiles });
    files = listed;
  } catch (error) {
    logError("proposal_media_library_list_failed", {
      message: error instanceof Error ? error.message : "unknown",
      bucket: bucketName,
      prefix,
    });
    return [];
  }

  const candidates = files.filter((f) => !f.name.endsWith("/"));
  const assets = await mapChunked(candidates, 24, async (file): Promise<ProposalLibraryAsset | null> => {
    const kind = inferKind(file.name);
    if (!kind) return null;
    let metadata: StorageObjectMetadata;
    try {
      const [m] = await file.getMetadata();
      metadata = m as StorageObjectMetadata;
    } catch {
      return null;
    }
    const downloadUrl = await downloadUrlFromMetadata(bucketName, file.name, file, metadata);
    if (!downloadUrl) return null;
    const durationSec = parseDurationSec(metadata.metadata as Record<string, unknown> | undefined);
    return {
      id: file.name,
      name: displayName(file.name, prefix),
      kind,
      downloadUrl,
      durationSec,
    };
  });

  return assets.filter((a): a is ProposalLibraryAsset => a !== null);
}
