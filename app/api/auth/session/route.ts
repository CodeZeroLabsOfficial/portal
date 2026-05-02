import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { FIREBASE_SESSION_COOKIE_NAME, FIREBASE_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-cookie";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { logError, logInfo } from "@/lib/logging";
import { COLLECTIONS } from "@/server/firestore/collections";
import type { PortalUser, UserRole } from "@/types/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSessionSchema = z.object({
  idToken: z.string().min(20),
});

function readRole(input: unknown): UserRole {
  if (input === "admin" || input === "team" || input === "customer") {
    return input;
  }
  return "customer";
}

export async function POST(request: Request) {
  const adminAuth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();

  if (!adminAuth || !db) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured on the server." },
      { status: 500 },
    );
  }

  let idToken = "";
  try {
    const payload = await request.json();
    idToken = createSessionSchema.parse(payload).idToken;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: FIREBASE_SESSION_MAX_AGE_SECONDS * 1000,
    });

    const uid = decoded.uid;
    const userRef = db.collection(COLLECTIONS.users).doc(uid);
    const existingSnap = await userRef.get();
    const existing = existingSnap.exists
      ? (existingSnap.data() as Partial<PortalUser> | undefined)
      : undefined;
    const nowMs = Date.now();
    const role = readRole(existing?.role);

    await userRef.set(
      {
        uid,
        email: decoded.email ?? existing?.email ?? "",
        displayName: decoded.name ?? existing?.displayName ?? "",
        photoURL: decoded.picture ?? existing?.photoURL ?? "",
        role,
        organizationId: existing?.organizationId ?? "",
        stripeCustomerId: existing?.stripeCustomerId ?? "",
        createdAtMs: existing?.createdAtMs ?? nowMs,
        updatedAtMs: nowMs,
      } satisfies PortalUser,
      { merge: true },
    );

    const cookieStore = await cookies();
    cookieStore.set(FIREBASE_SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: FIREBASE_SESSION_MAX_AGE_SECONDS,
    });

    logInfo("auth_session_created", { uid });
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logError("auth_session_create_failed", {
      message,
    });
    const isDevelopment = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: isDevelopment ? `Unable to create authenticated session: ${message}` : "Unable to create authenticated session.",
      },
      { status: 401 },
    );
  }
}
