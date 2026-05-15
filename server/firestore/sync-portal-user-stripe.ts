import type { Firestore } from "firebase-admin/firestore";
import { asString } from "@/lib/firestore/coerce";
import { logError } from "@/lib/logging";
import { COLLECTIONS } from "@/server/firestore/collections";

/**
 * When a CRM customer has `portalUserId` (Link Firebase Auth) and `stripeCustomerId`,
 * mirror the Stripe id onto `users/{uid}` so the same login works on web and iOS for
 * billing portal, mirrored subscriptions/invoices, and callable payment flows.
 */
export async function syncStripeCustomerIdToLinkedPortalUser(
  db: Firestore,
  portalUserId: string | null | undefined,
  stripeCustomerId: string | null | undefined,
): Promise<void> {
  const uid = typeof portalUserId === "string" ? portalUserId.trim() : "";
  const sid = typeof stripeCustomerId === "string" ? stripeCustomerId.trim() : "";
  if (!uid || !sid.startsWith("cus_")) return;
  try {
    await db.collection(COLLECTIONS.users).doc(uid).set({ stripeCustomerId: sid, updatedAtMs: Date.now() }, { merge: true });
  } catch (err) {
    logError("sync_portal_user_stripe_failed", {
      uid,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Loads `customers/{customerId}` and pushes `stripeCustomerId` to `users/{portalUserId}` when both are set. */
export async function syncStripeCustomerIdFromCrmCustomerDoc(db: Firestore, customerId: string): Promise<void> {
  const id = customerId.trim();
  if (!id) return;
  try {
    const snap = await db.collection(COLLECTIONS.customers).doc(id).get();
    if (!snap.exists) return;
    const data = snap.data() as Record<string, unknown> | undefined;
    await syncStripeCustomerIdToLinkedPortalUser(db, asString(data?.portalUserId), asString(data?.stripeCustomerId));
  } catch (err) {
    logError("sync_portal_user_stripe_read_failed", {
      customerId: id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
