/** Vercel request body limit is ~4.5 MB; stay under with margin for multipart overhead. */
const VERCEL_SAFE_DIRECT_BYTES = Math.floor(4.5 * 1024 * 1024 * 0.92);

const OFF_VERCEL_DEFAULT_BYTES = 32 * 1024 * 1024;

function isVercelDeploy(): boolean {
  if (typeof window !== "undefined") {
    return (
      typeof process.env.NEXT_PUBLIC_VERCEL_ENV === "string" && process.env.NEXT_PUBLIC_VERCEL_ENV.length > 0
    );
  }
  return process.env.VERCEL === "1";
}

function readConfiguredMaxBytes(): number | null {
  let raw = "";
  if (typeof window === "undefined") {
    raw =
      (typeof process.env.PROPOSAL_MEDIA_LIBRARY_MAX_DIRECT_UPLOAD_BYTES === "string" &&
        process.env.PROPOSAL_MEDIA_LIBRARY_MAX_DIRECT_UPLOAD_BYTES.trim()) ||
      (typeof process.env.NEXT_PUBLIC_PROPOSAL_MEDIA_LIBRARY_MAX_DIRECT_UPLOAD_BYTES === "string" &&
        process.env.NEXT_PUBLIC_PROPOSAL_MEDIA_LIBRARY_MAX_DIRECT_UPLOAD_BYTES.trim()) ||
      "";
  } else {
    raw =
      (typeof process.env.NEXT_PUBLIC_PROPOSAL_MEDIA_LIBRARY_MAX_DIRECT_UPLOAD_BYTES === "string" &&
        process.env.NEXT_PUBLIC_PROPOSAL_MEDIA_LIBRARY_MAX_DIRECT_UPLOAD_BYTES.trim()) ||
      "";
  }
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 256 * 1024) {
    return Math.min(50 * 1024 * 1024, Math.floor(n));
  }
  return null;
}

function defaultMaxBytes(): number {
  return isVercelDeploy() ? VERCEL_SAFE_DIRECT_BYTES : OFF_VERCEL_DEFAULT_BYTES;
}

/** Same-origin multipart limit; keep server logic in sync via this module. */
export function getProposalMediaLibraryDirectUploadMaxBytes(): number {
  return readConfiguredMaxBytes() ?? defaultMaxBytes();
}

/** Resolved at module load (Next inlines env at build time). */
export const PROPOSAL_MEDIA_LIBRARY_DIRECT_UPLOAD_MAX_BYTES = getProposalMediaLibraryDirectUploadMaxBytes();

export function formatDirectUploadMaxMbOneDecimal(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const rounded = Math.round(mb * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
