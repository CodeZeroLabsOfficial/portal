import { randomBytes } from "node:crypto";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-app";
import { logError } from "@/lib/logging";

function authErrorCode(err: unknown): string {
  if (typeof err !== "object" || err === null || !("code" in err)) return "";
  return String((err as { code?: unknown }).code ?? "");
}

/** Random password meeting typical Firebase minimum length; user sets a real password via reset link. */
function temporaryFirebasePassword(): string {
  return `${randomBytes(32).toString("base64url")}Aa9!`;
}

export interface ResolveOrCreateFirebaseUserOptions {
  /** When false, skip all work and return `uid: null`. */
  active: boolean;
  /** When lookup finds no user, create an email/password Firebase user (temporary password; staff sends setup link from CRM). */
  createIfMissing: boolean;
}

export type ResolveOrCreateFirebaseUserResult =
  | { ok: true; uid: string | null; createdNew: boolean }
  | { ok: false; message: string };

/**
 * Looks up User Access by email, or creates an email/password user when `createIfMissing` is true.
 * Password setup links are generated on demand from the customer detail **Portal access** card.
 */
export async function resolveOrCreateFirebaseUserByEmail(
  emailRaw: string,
  options: ResolveOrCreateFirebaseUserOptions,
): Promise<ResolveOrCreateFirebaseUserResult> {
  if (!options.active) {
    return { ok: true, uid: null, createdNew: false };
  }

  const auth = getFirebaseAdminAuth();
  if (!auth) {
    return { ok: false, message: "Firebase Admin is not configured." };
  }

  const email = emailRaw.trim().toLowerCase();
  if (!email) {
    return { ok: false, message: "Email is required to manage Firebase login." };
  }

  try {
    const existing = await auth.getUserByEmail(email);
    return { ok: true, uid: existing.uid, createdNew: false };
  } catch (lookupErr: unknown) {
    const code = authErrorCode(lookupErr);
    if (code !== "auth/user-not-found") {
      logError("resolve_firebase_user_lookup_failed", {
        email,
        code,
        message: lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
      });
      return { ok: false, message: "Could not look up Firebase user for this email." };
    }

    if (!options.createIfMissing) {
      return { ok: true, uid: null, createdNew: false };
    }

    try {
      const password = temporaryFirebasePassword();
      const rec = await auth.createUser({
        email,
        password,
        emailVerified: false,
        disabled: false,
      });
      return { ok: true, uid: rec.uid, createdNew: true };
    } catch (createErr: unknown) {
      const createCode = authErrorCode(createErr);
      if (createCode === "auth/email-already-exists") {
        try {
          const existing = await auth.getUserByEmail(email);
          return { ok: true, uid: existing.uid, createdNew: false };
        } catch {
          return { ok: false, message: "An account with this email already exists." };
        }
      }
      logError("resolve_firebase_user_create_failed", {
        email,
        code: createCode,
        message: createErr instanceof Error ? createErr.message : String(createErr),
      });
      return {
        ok: false,
        message:
          createErr instanceof Error ? createErr.message : "Failed to create Firebase user for this email.",
      };
    }
  }
}
