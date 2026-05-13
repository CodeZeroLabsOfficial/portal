import type { ProposalLibraryAsset, ProposalLibraryAssetKind } from "@/lib/proposal-media-library-types";

export const PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX = "proposal-media-library/";

/** MIME types allowed for proposal library uploads (must align with file extensions in {@link inferProposalLibraryKind}). */
export const PROPOSAL_LIBRARY_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "text/html",
  "application/json",
] as const;

export function getProposalMediaLibraryPrefix(): string {
  const raw = process.env.PROPOSAL_MEDIA_LIBRARY_PREFIX;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().replace(/\/?$/, "/");
  }
  return PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX;
}

export function inferProposalLibraryKind(objectPath: string): ProposalLibraryAssetKind | null {
  const base = objectPath.split("/").pop()?.toLowerCase() ?? "";
  if (/\.(jpe?g|png|gif|webp|avif|svg)$/.test(base)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(base)) return "video";
  if (/\.(html?)$/.test(base)) return "snippet";
  if (/\.(json)$/.test(base)) return "block";
  return null;
}

export function displayNameFromPathname(objectPath: string, prefix: string): string {
  const trimmed = objectPath.startsWith(prefix) ? objectPath.slice(prefix.length) : objectPath;
  const seg = trimmed.split("/").filter(Boolean);
  return seg[seg.length - 1] ?? objectPath;
}

/**
 * Builds a pathname under the library prefix from a user-selected file name (basename only).
 */
export function buildLibraryUploadPathname(prefix: string, fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "upload";
  const safe = base.replace(/[^\w.\-()+]/gi, "_").slice(0, 180);
  if (!safe) {
    throw new Error("Invalid file name");
  }
  const normalizedPrefix = prefix.replace(/\/?$/, "/");
  return `${normalizedPrefix}${safe}`;
}

export function assertStaffLibraryBlobPathname(pathname: string): void {
  const prefix = getProposalMediaLibraryPrefix();
  if (!pathname.startsWith(prefix)) {
    throw new Error("Invalid upload path");
  }
  if (pathname.includes("..")) {
    throw new Error("Invalid upload path");
  }
  const relative = pathname.slice(prefix.length);
  if (!relative || relative.includes("/")) {
    throw new Error("Upload files to the library root only");
  }
  if (!inferProposalLibraryKind(pathname)) {
    throw new Error("Unsupported file type for the proposal library");
  }
}

export function proposalLibraryAssetFromBlobListItem(
  item: { pathname: string; url: string },
  prefix: string,
): ProposalLibraryAsset | null {
  const kind = inferProposalLibraryKind(item.pathname);
  if (!kind) return null;
  return {
    id: item.pathname,
    name: displayNameFromPathname(item.pathname, prefix),
    kind,
    downloadUrl: item.url,
  };
}
