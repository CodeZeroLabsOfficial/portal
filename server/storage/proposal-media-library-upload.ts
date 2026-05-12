import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getFirebaseAdminStorage } from "@/lib/firebase/admin-app";

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
  const raw = process.env.PROPOSAL_MEDIA_LIBRARY_PREFIX ?? "proposal-media-library/";
  return raw.replace(/\/?$/, "/");
}

export function buildLibraryUploadObjectPath(safeFilename: string): string {
  const prefix = getProposalMediaLibraryPrefix();
  return `${prefix}uploads/${Date.now()}-${randomUUID().slice(0, 8)}-${safeFilename}`;
}

const DEFAULT_MAX_DIRECT_BYTES = 4 * 1024 * 1024;

export function getMaxDirectLibraryUploadBytes(): number {
  const raw = process.env.PROPOSAL_MEDIA_LIBRARY_MAX_DIRECT_UPLOAD_BYTES;
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 256 * 1024) {
    return Math.min(50 * 1024 * 1024, Math.floor(n));
  }
  return DEFAULT_MAX_DIRECT_BYTES;
}

export async function saveLibraryUploadFromWebFile(file: File): Promise<{ objectPath: string }> {
  const maxBytes = getMaxDirectLibraryUploadBytes();
  const size = typeof file.size === "number" ? file.size : Number.NaN;
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("The file is empty.");
  }
  if (size > maxBytes) {
    throw new Error(
      `This file is larger than the direct upload limit (${Math.max(1, Math.floor(maxBytes / (1024 * 1024)))} MB). Increase PROPOSAL_MEDIA_LIBRARY_MAX_DIRECT_UPLOAD_BYTES, or configure Storage CORS and upload larger files via signed URL.`,
    );
  }

  const storage = getFirebaseAdminStorage();
  if (!storage) {
    throw new Error("Firebase Storage is not configured on the server.");
  }

  const bucketName =
    (typeof process.env.FIREBASE_STORAGE_BUCKET === "string" && process.env.FIREBASE_STORAGE_BUCKET.trim()) ||
    (typeof process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET === "string" &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.trim()) ||
    "";
  if (!bucketName) {
    throw new Error("Storage bucket is not configured (FIREBASE_STORAGE_BUCKET).");
  }

  const safe = sanitizeLibraryUploadFilename(file.name);
  assertAllowedLibraryExtension(safe);
  const resolvedType = inferLibraryContentType(safe, file.type || "application/octet-stream");
  if (resolvedType === "application/octet-stream") {
    throw new Error("Could not determine content type; use a file with a known extension.");
  }

  const objectPath = buildLibraryUploadObjectPath(safe);
  const bucket = storage.bucket(bucketName);
  const writeStream = bucket.file(objectPath).createWriteStream({
    metadata: { contentType: resolvedType },
    resumable: false,
  });

  const webStream = file.stream();
  const nodeReadable = Readable.fromWeb(webStream as import("stream/web").ReadableStream<Uint8Array>);
  await pipeline(nodeReadable, writeStream);

  return { objectPath };
}

export async function createProposalMediaLibrarySignedPutUrl(filename: string, contentType: string) {
  const storage = getFirebaseAdminStorage();
  if (!storage) {
    throw new Error("Firebase Storage is not configured on the server.");
  }

  const bucketName =
    (typeof process.env.FIREBASE_STORAGE_BUCKET === "string" && process.env.FIREBASE_STORAGE_BUCKET.trim()) ||
    (typeof process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET === "string" &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.trim()) ||
    "";
  if (!bucketName) {
    throw new Error("Storage bucket is not configured (FIREBASE_STORAGE_BUCKET).");
  }

  const safe = sanitizeLibraryUploadFilename(filename);
  assertAllowedLibraryExtension(safe);

  const resolvedType = inferLibraryContentType(safe, contentType);
  if (resolvedType === "application/octet-stream") {
    throw new Error("Could not determine content type; use a file with a known extension.");
  }

  const objectPath = buildLibraryUploadObjectPath(safe);

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 20 * 60 * 1000,
    contentType: resolvedType,
  });

  return {
    uploadUrl,
    objectPath,
    contentType: resolvedType,
    bucket: bucketName,
  };
}
