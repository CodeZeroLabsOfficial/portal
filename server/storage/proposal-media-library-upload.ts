import { put } from "@vercel/blob";
import { getProposalMediaLibraryDirectUploadMaxBytes } from "@/lib/proposal-media-library-direct-upload-limit";
import {
  assertAllowedLibraryExtension,
  buildProposalMediaLibraryUploadPathname,
  inferLibraryContentType,
  sanitizeLibraryUploadFilename,
} from "@/lib/proposal-media-library-blob";

export {
  assertAllowedLibraryExtension,
  buildProposalMediaLibraryUploadPathname,
  extensionOf,
  getProposalMediaLibraryPrefix,
  inferLibraryContentType,
  sanitizeLibraryUploadFilename,
} from "@/lib/proposal-media-library-blob";

export function getMaxDirectLibraryUploadBytes(): number {
  return getProposalMediaLibraryDirectUploadMaxBytes();
}

function assertBlobConfigured(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set (Vercel Blob read/write token).");
  }
}

export async function saveLibraryUploadFromWebFile(file: File): Promise<{ objectPath: string }> {
  const maxBytes = getMaxDirectLibraryUploadBytes();
  const size = typeof file.size === "number" ? file.size : Number.NaN;
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("The file is empty.");
  }
  if (size > maxBytes) {
    throw new Error(
      `This file is larger than the direct upload limit (${Math.max(1, Math.floor(maxBytes / (1024 * 1024)))} MB). Use a smaller file or upload completes via the client for larger assets.`,
    );
  }

  assertBlobConfigured();

  const safe = sanitizeLibraryUploadFilename(file.name);
  assertAllowedLibraryExtension(safe);
  const resolvedType = inferLibraryContentType(safe, file.type || "application/octet-stream");
  if (resolvedType === "application/octet-stream") {
    throw new Error("Could not determine content type; use a file with a known extension.");
  }

  const pathname = buildProposalMediaLibraryUploadPathname(safe);
  await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: resolvedType,
  });

  return { objectPath: pathname };
}
