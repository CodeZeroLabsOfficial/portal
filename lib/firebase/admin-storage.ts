import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp, getFirebaseStorageBucketName } from "@/lib/firebase/admin-app";
import { logError } from "@/lib/logging";

const MAX_SIGNATURE_BYTES = 2_400_000;

/**
 * Uploads a PNG signature to the default Firebase Storage bucket (best-effort).
 * Returns a `gs://` path for Firestore; clients do not receive a download URL here.
 */
export async function uploadSignedAgreementSignaturePng(params: {
  proposalId: string;
  dataUrlPng: string;
}): Promise<{ storagePath: string } | null> {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  if (!params.dataUrlPng.startsWith("data:image/png;base64,")) return null;
  const b64 = params.dataUrlPng.slice("data:image/png;base64,".length);
  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0 || buffer.length > MAX_SIGNATURE_BYTES) return null;

  const projectIdFromApp =
    typeof app.options.projectId === "string" && app.options.projectId.length > 0
      ? app.options.projectId
      : undefined;
  const bucketName = getFirebaseStorageBucketName(projectIdFromApp);
  if (!bucketName) {
    logError("signed_agreement_storage_bucket_unconfigured", {
      proposalId: params.proposalId,
      message:
        "Set FIREBASE_STORAGE_BUCKET (recommended), or set FIREBASE_PROJECT_ID / NEXT_PUBLIC_FIREBASE_PROJECT_ID so the default bucket `{projectId}.firebasestorage.app` can be used. Legacy buckets may use `{projectId}.appspot.com`.",
    });
    return null;
  }

  try {
    const bucket = getStorage(app).bucket(bucketName);
    const storagePath = `signed-agreements/${params.proposalId}/${Date.now()}-${randomUUID().slice(0, 8)}.png`;
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      contentType: "image/png",
      resumable: false,
      metadata: { cacheControl: "private, max-age=0" },
    });
    return { storagePath };
  } catch (error) {
    logError("signed_agreement_signature_upload_failed", {
      proposalId: params.proposalId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/**
 * Short-lived HTTPS URL for a private Storage object (e.g. signature PNG in staff document viewer).
 */
export async function getStorageFileSignedReadUrl(
  storagePath: string,
  expiresMs = 60 * 60 * 1000,
): Promise<string | null> {
  const app = getFirebaseAdminApp();
  const trimmed = storagePath.trim();
  if (!app || !trimmed) return null;
  const projectIdFromApp =
    typeof app.options.projectId === "string" && app.options.projectId.length > 0
      ? app.options.projectId
      : undefined;
  const bucketName = getFirebaseStorageBucketName(projectIdFromApp);
  if (!bucketName) return null;
  try {
    const bucket = getStorage(app).bucket(bucketName);
    const [url] = await bucket.file(trimmed).getSignedUrl({
      action: "read",
      expires: Date.now() + expiresMs,
    });
    return url;
  } catch (error) {
    logError("storage_signed_read_url_failed", {
      storagePath: trimmed,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}
