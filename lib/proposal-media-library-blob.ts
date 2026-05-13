const ALLOWED_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "svg",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "mp4",
  "webm",
  "mov",
  "m4v",
  "ogv",
  "mpeg",
  "mpg",
  "mkv",
  "html",
  "htm",
  "json",
]);

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  ogv: "video/ogg",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  mkv: "video/x-matroska",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
};

/** Content types allowed for Vercel Blob client-token uploads (library assets). */
export const PROPOSAL_MEDIA_LIBRARY_BLOB_ALLOWED_CONTENT_TYPES: string[] = [
  ...new Set(
    [...ALLOWED_EXT].map((ext) => EXT_TO_CONTENT_TYPE[ext]).filter((t): t is string => Boolean(t)),
  ),
];

export function sanitizeLibraryUploadFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").trim();
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 180) || "upload.bin";
}

export function extensionOf(filename: string): string | null {
  const base = sanitizeLibraryUploadFilename(filename);
  const i = base.lastIndexOf(".");
  if (i < 0) return null;
  return base.slice(i + 1).toLowerCase() || null;
}

export function inferLibraryContentType(filename: string, reported: string): string {
  const ext = extensionOf(filename);
  if (reported && reported !== "application/octet-stream") return reported;
  if (ext && EXT_TO_CONTENT_TYPE[ext]) return EXT_TO_CONTENT_TYPE[ext];
  return "application/octet-stream";
}

export function assertAllowedLibraryExtension(filename: string): void {
  const ext = extensionOf(filename);
  if (!ext || !ALLOWED_EXT.has(ext)) {
    throw new Error(
      "Unsupported file type. Use images (jpg, png, webp, …), video (mp4, webm, mov), .html snippets, or .json blocks.",
    );
  }
}

export function getProposalMediaLibraryPrefix(): string {
  const raw =
    (typeof process.env.NEXT_PUBLIC_PROPOSAL_MEDIA_LIBRARY_PREFIX === "string" &&
      process.env.NEXT_PUBLIC_PROPOSAL_MEDIA_LIBRARY_PREFIX.trim()) ||
    (typeof process.env.PROPOSAL_MEDIA_LIBRARY_PREFIX === "string" &&
      process.env.PROPOSAL_MEDIA_LIBRARY_PREFIX.trim()) ||
    "proposal-media-library/";
  return raw.replace(/\/?$/, "/");
}

export function buildProposalMediaLibraryUploadPathname(safeFilename: string): string {
  const prefix = getProposalMediaLibraryPrefix();
  const short =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : `${Date.now()}`;
  return `${prefix}uploads/${Date.now()}-${short}-${safeFilename}`;
}

/**
 * Ensures client-provided pathname is under our uploads prefix and uses an allowed extension.
 */
export function assertValidProposalMediaLibraryUploadPathname(pathname: string): void {
  const prefix = getProposalMediaLibraryPrefix();
  const expected = `${prefix}uploads/`;
  if (!pathname.startsWith(expected)) {
    throw new Error("Invalid upload path.");
  }
  const rest = pathname.slice(expected.length);
  if (!rest || rest.includes("/") || rest.includes("..")) {
    throw new Error("Invalid upload path.");
  }
  assertAllowedLibraryExtension(rest);
}
