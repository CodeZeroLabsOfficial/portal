import { readFileSync } from "node:fs";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/env/server";
import { logError } from "@/lib/logging";

function getExplicitProjectId(): string | undefined {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  return typeof projectId === "string" && projectId.length > 0 ? projectId : undefined;
}

/**
 * Resolves the Firebase Storage bucket name for Admin SDK uploads.
 *
 * **Where to set it**
 * - Prefer server env `FIREBASE_STORAGE_BUCKET` (e.g. `my-project.firebasestorage.app`).
 * - Or `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` if you already expose it for the client SDK.
 * - If neither is set, falls back to `{projectId}.firebasestorage.app` using
 *   `FIREBASE_PROJECT_ID` / `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, or `projectIdOverride`
 *   (e.g. service account `project_id`) when the env project id is missing.
 *
 * Older projects sometimes use `{projectId}.appspot.com` — set `FIREBASE_STORAGE_BUCKET` explicitly in that case.
 */
export function getFirebaseStorageBucketName(projectIdOverride?: string | null): string | null {
  const fromServerEnv = getServerEnv().FIREBASE_STORAGE_BUCKET?.trim();
  const fromProcess =
    (typeof process.env.FIREBASE_STORAGE_BUCKET === "string" && process.env.FIREBASE_STORAGE_BUCKET.trim()) ||
    (typeof process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET === "string" &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.trim());
  const explicit = fromServerEnv || fromProcess;
  if (explicit) return explicit;
  const projectId =
    (typeof projectIdOverride === "string" && projectIdOverride.trim()) || getExplicitProjectId();
  if (!projectId?.trim()) return null;
  return `${projectId.trim()}.firebasestorage.app`;
}

function firebaseAppOptions(projectId: string | undefined): {
  projectId?: string;
  storageBucket?: string;
} {
  const bucketName = getFirebaseStorageBucketName(projectId);
  return {
    ...(projectId ? { projectId } : {}),
    ...(bucketName ? { storageBucket: bucketName } : {}),
  };
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
      const resolvedProjectId =
        projectId ?? (typeof serviceAccount.project_id === "string" ? serviceAccount.project_id : undefined);
      return initializeApp({
        credential: cert(serviceAccount),
        ...firebaseAppOptions(resolvedProjectId),
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
      const resolvedProjectId =
        projectId ?? (typeof serviceAccount.project_id === "string" ? serviceAccount.project_id : undefined);
      return initializeApp({
        credential: cert(serviceAccount),
        ...firebaseAppOptions(resolvedProjectId),
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
      ...firebaseAppOptions(projectId),
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

/**
 * Cache the configured Firestore instance on `globalThis` so the
 * `settings()` call survives Next.js dev-server hot-reloads. `getFirestore`
 * is internally cached per App, so calling it again returns the same
 * instance — but `settings()` can only be called once per instance, so we
 * track which apps we've already configured.
 */
const FIRESTORE_CONFIGURED = Symbol.for("__codezero.firebaseAdmin.firestoreConfigured__");
type GlobalWithFirestoreFlag = typeof globalThis & {
  [FIRESTORE_CONFIGURED]?: WeakSet<App>;
};

export function getFirebaseAdminFirestore(): Firestore | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  const db = getFirestore(app);
  const g = globalThis as GlobalWithFirestoreFlag;
  const configured = g[FIRESTORE_CONFIGURED] ?? (g[FIRESTORE_CONFIGURED] = new WeakSet<App>());
  if (!configured.has(app)) {
    try {
      /**
       * Skip `undefined` values on writes. Several normalizers (e.g. proposal
       * package tiers) intentionally produce optional fields whose value may
       * be `undefined`; without this setting the Admin SDK throws on the
       * first such field and the surrounding write fails entirely.
       */
      db.settings({ ignoreUndefinedProperties: true });
    } catch (error) {
      /**
       * `settings()` throws if it has already been called on this Firestore
       * instance — which can happen after an HMR reload that wiped our
       * cache. Either way, the prior `settings()` call's flags persist, so
       * this is safe to ignore.
       */
      logError("firebase_admin_firestore_settings_skipped", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
    configured.add(app);
  }
  return db;
}
