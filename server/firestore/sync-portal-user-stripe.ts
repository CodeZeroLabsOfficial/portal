import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { asString } from "@/lib/firestore/coerce";
import { logError } from "@/lib/logging";
import { COLLECTIONS } from "@/server/firestore/collections";

function isStaffRole(role: unknown): boolean {
  return role === "admin" || role === "team";
}

function isTimestampLike(v: unknown): v is Timestamp {
  return (
    typeof v === "object" &&
    v !== null &&
    "toMillis" in v &&
    typeof (v as Timestamp).toMillis === "function"
  );
}

/**
 * Provisions / updates `users/{portalUserId}` from `customers/{customerId}` when `portalUserId` is set:
 * `uid`, `email`, `name`, `displayName`, `role: customer` (unless existing staff), `stripeCustomerId`,
 * `organizationId`, `createdAt` / `updatedAt` as Firestore Timestamps, plus `createdAtMs` / `updatedAtMs`
 * for existing portal session code.
 */
export async function syncPortalUserFromCrmCustomerDoc(db: Firestore, customerId: string): Promise<void> {
  const id = customerId.trim();
  if (!id) return;
  try {
    const snap = await db.collection(COLLECTIONS.customers).doc(id).get();
    if (!snap.exists) return;
    const raw = snap.data();
    if (!raw) return;
    const data = raw as Record<string, unknown>;
    const portalUserId = (asString(data.portalUserId) ?? "").trim();
    if (!portalUserId) return;

    const email = (asString(data.email) ?? "").trim().toLowerCase();
    if (!email) {
      logError("sync_portal_user_missing_email", { customerId: id, portalUserId });
      return;
    }

    const name = (asString(data.name) ?? "").trim();
    const displayName = name || email;
    const stripeRaw = (asString(data.stripeCustomerId) ?? "").trim();
    const stripeCustomerId = stripeRaw.startsWith("cus_") ? stripeRaw : "";
    const organizationId = (asString(data.organizationId) ?? "").trim();

    const ref = db.collection(COLLECTIONS.users).doc(portalUserId);
    const userSnap = await ref.get();
    const existing = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : undefined;
    const nowTs = Timestamp.now();
    const nowMs = nowTs.toMillis();

    const payload: Record<string, unknown> = {
      uid: portalUserId,
      email,
      name: displayName,
      displayName,
      updatedAt: nowTs,
      updatedAtMs: nowMs,
    };

    if (!isStaffRole(existing?.role)) {
      payload.role = "customer";
    }

    payload.stripeCustomerId = stripeCustomerId;

    if (organizationId) {
      payload.organizationId = organizationId;
    }

    if (!userSnap.exists) {
      payload.createdAt = nowTs;
      payload.createdAtMs = nowMs;
    } else {
      const ex = existing;
      if (!ex) return;
      const hasCreatedAt = ex.createdAt != null && isTimestampLike(ex.createdAt);
      const hasCreatedAtMs = typeof ex.createdAtMs === "number" && Number.isFinite(ex.createdAtMs);

      if (!hasCreatedAt && !hasCreatedAtMs) {
        payload.createdAt = nowTs;
        payload.createdAtMs = nowMs;
      } else if (!hasCreatedAt && hasCreatedAtMs) {
        payload.createdAt = Timestamp.fromMillis(ex.createdAtMs as number);
      } else if (hasCreatedAt && !hasCreatedAtMs) {
        payload.createdAtMs = (ex.createdAt as Timestamp).toMillis();
      }
    }

    await ref.set(payload, { merge: true });
  } catch (err) {
    logError("sync_portal_user_from_crm_failed", {
      customerId: id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/** @deprecated Prefer {@link syncPortalUserFromCrmCustomerDoc} — name kept for existing imports. */
export async function syncStripeCustomerIdFromCrmCustomerDoc(db: Firestore, customerId: string): Promise<void> {
  return syncPortalUserFromCrmCustomerDoc(db, customerId);
}
