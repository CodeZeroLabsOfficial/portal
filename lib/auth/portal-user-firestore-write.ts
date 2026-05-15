import type { PortalUser } from "@/types/user";

/** Firestore `users/{uid}` must not persist derived `joinedAt` (see {@link PortalUser.joinedAt}). */
export function portalUserFirestorePayload(user: PortalUser): Record<string, unknown> {
  const out = { ...user } as Record<string, unknown>;
  delete out.joinedAt;
  return out;
}
