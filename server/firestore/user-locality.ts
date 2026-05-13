import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { asString } from "@/lib/firestore/coerce";
import { COLLECTIONS } from "@/server/firestore/collections";

/** Reads `users/{uid}.timeZone` for public proposal rendering (creator locality). */
export async function getUserStoredTimeZone(uid: string): Promise<string | undefined> {
  const id = uid.trim();
  if (!id) return undefined;
  const db = getFirebaseAdminFirestore();
  if (!db) return undefined;
  const snap = await db.collection(COLLECTIONS.users).doc(id).get();
  if (!snap.exists) return undefined;
  const tz = asString((snap.data() as Record<string, unknown>)?.timeZone)?.trim();
  return tz || undefined;
}
