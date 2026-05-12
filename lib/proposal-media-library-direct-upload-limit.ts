/**
 * Max size for same-origin `POST /api/proposal-media-library/upload` (multipart).
 * Keep aligned with server default in `server/storage/proposal-media-library-upload.ts`
 * (`DEFAULT_MAX_DIRECT_BYTES` / `PROPOSAL_MEDIA_LIBRARY_MAX_DIRECT_UPLOAD_BYTES`).
 */
export const PROPOSAL_MEDIA_LIBRARY_DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
