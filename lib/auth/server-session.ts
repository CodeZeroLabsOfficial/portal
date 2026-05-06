import { cookies } from "next/headers";
import { FIREBASE_SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { asNumber, asString } from "@/lib/firestore/coerce";
import { COLLECTIONS } from "@/server/firestore/collections";
import type { PortalUser, UserRole } from "@/types/user";

/** Roles that can access admin-side CRM, billing, proposal, and operations data. */
export const STAFF_ROLES: readonly UserRole[] = ["admin", "team"];

function asRole(value: unknown): UserRole {
  if (value === "admin" || value === "team" || value === "customer") {
    return value;
  }
  return "customer";
}

function normalizePortalUser(uid: string, email: string, data?: Partial<PortalUser>): PortalUser {
  const nowMs = Date.now();
  return {
    uid,
    email,
    displayName: asString(data?.displayName),
    photoURL: asString(data?.photoURL),
    role: asRole(data?.role),
    organizationId: asString(data?.organizationId),
    stripeCustomerId: asString(data?.stripeCustomerId),
    firstName: asString(data?.firstName),
    lastName: asString(data?.lastName),
    phone: asString(data?.phone),
    website: asString(data?.website),
    dateOfBirth: asString(data?.dateOfBirth),
    addressLine1: asString(data?.addressLine1),
    addressLine2: asString(data?.addressLine2),
    city: asString(data?.city),
    region: asString(data?.region),
    postalCode: asString(data?.postalCode),
    country: asString(data?.country),
    timeZone: asString(data?.timeZone),
    languageTag: asString(data?.languageTag),
    dateFormatPreset: asString(data?.dateFormatPreset),
    timeFormatPreset: asString(data?.timeFormatPreset),
    localeRegionCode: asString(data?.localeRegionCode),
    currencyCode: asString(data?.currencyCode),
    createdAtMs: asNumber(data?.createdAtMs) ?? nowMs,
    updatedAtMs: asNumber(data?.updatedAtMs) ?? nowMs,
  };
}

/**
 * Validates Firebase session cookie and returns app user data from Firestore.
 * Returns `null` when no valid session/admin config exists.
 */
export async function getCurrentSessionUser(): Promise<PortalUser | null> {
  const adminAuth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();
  if (!adminAuth || !db) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;
    const email = decoded.email ?? "";

    const userSnap = await db.collection(COLLECTIONS.users).doc(uid).get();
    const stored = userSnap.exists ? (userSnap.data() as Partial<PortalUser>) : undefined;
    const normalized = normalizePortalUser(uid, email, stored);

    if (!userSnap.exists) {
      await db.collection(COLLECTIONS.users).doc(uid).set(normalized, { merge: true });
    }

    return normalized;
  } catch {
    return null;
  }
}

export function hasRole(user: PortalUser, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

/** True when the user can access admin/team-only pages and actions. */
export function isStaff(user: PortalUser): boolean {
  return STAFF_ROLES.includes(user.role);
}

/**
 * Convenience wrapper around {@link getCurrentSessionUser} that returns `null`
 * when there is no session OR the user isn't a staff member. Use in server
 * actions that gate everything behind admin/team access.
 */
export async function requireStaffSession(): Promise<PortalUser | null> {
  const user = await getCurrentSessionUser();
  return user && isStaff(user) ? user : null;
}
