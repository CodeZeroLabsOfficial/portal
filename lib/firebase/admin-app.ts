import { readFileSync } from "node:fs";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/env/server";
import { logError } from "@/lib/logging";

function getExplicitProjectId(): string | undefined {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  return typeof projectId === "string" && projectId.length > 0 ? projectId : undefined;
}

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
  const projectId = getExplicitProjectId();
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as Record<
        string,
        unknown
      >;
      return initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } catch (error) {
      logError("firebase_admin_init_json_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  }

  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const fileContents = readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, "utf8");
      const serviceAccount = JSON.parse(fileContents) as Record<string, unknown>;
      return initializeApp({
        credential: cert(serviceAccount),
        projectId: projectId ?? (serviceAccount.project_id as string | undefined),
      });
    } catch (error) {
      logError("firebase_admin_init_file_failed", {
        message: error instanceof Error ? error.message : "unknown",
        googleApplicationCredentials: env.GOOGLE_APPLICATION_CREDENTIALS,
      });
      return null;
    }
  }

  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  } catch (error) {
    logError("firebase_admin_init_default_failed", {
      message: error instanceof Error ? error.message : "unknown",
      hasGoogleApplicationCredentials: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      projectId,
    });
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
