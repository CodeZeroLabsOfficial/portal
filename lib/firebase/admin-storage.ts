import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp } from "@/lib/firebase/admin-app";
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

  try {
    const bucket = getStorage(app).bucket();
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
