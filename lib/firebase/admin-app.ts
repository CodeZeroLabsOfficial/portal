import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/env/server";

/**
 * Firebase Admin for server routes, Server Actions, and middleware session verification.
 * Returns `null` when credentials are not configured (local dev without service account).
 *
 * Firestore security rules must enforce:
 * - Users read/write only their own `users/{uid}` document fields allowed by role.
 * - `subscriptions`, `invoices`, `proposals` scoped by org/customer with role checks.
 * - Deny direct client access to webhook-written Stripe mirrors unless rule predicates match.
 */
export function getFirebaseAdminApp(): App | null {
  if (getApps().length > 0) {
    return getApps()[0] ?? null;
  }

  const env = getServerEnv();
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as Record<
        string,
        unknown
      >;
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } catch {
      return null;
    }
  }

  try {
    return initializeApp({
      credential: applicationDefault(),
    });
  } catch {
    return null;
  }
}

export function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  return app ? getAuth(app) : null;
}

export function getFirebaseAdminFirestore() {
  const app = getFirebaseAdminApp();
  return app ? getFirestore(app) : null;
}
