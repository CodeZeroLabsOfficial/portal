import { upload } from "@vercel/blob/client";
import {
  PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX,
  buildLibraryUploadPathname,
  proposalLibraryAssetFromBlobListItem,
} from "@/lib/proposal-media-library-blob";

export async function fetchProposalMediaLibraryPrefix(): Promise<string> {
  try {
    const res = await fetch("/api/proposal-media-library");
    if (!res.ok) return PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX;
    const data = (await res.json()) as { libraryPrefix?: string };
    if (typeof data.libraryPrefix === "string" && data.libraryPrefix.trim()) {
      return data.libraryPrefix.trim().replace(/\/?$/, "/");
    }
  } catch {
    /* ignore */
  }
  return PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX;
}

export async function uploadImageFileToProposalLibrary(prefix: string, file: File): Promise<string> {
  const pathname = buildLibraryUploadPathname(prefix, file.name);
  const result = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/proposal-media-library/upload",
    multipart: file.size > 4_500_000,
  });
  const asset = proposalLibraryAssetFromBlobListItem(result, prefix);
  if (asset?.kind !== "image") {
    throw new Error("Upload did not return an image.");
  }
  return asset.downloadUrl;
}
