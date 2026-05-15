import type { PortalUser } from "@/types/user";

/** Firestore `users/{uid}` must not persist derived `joinedAtMs` (see {@link PortalUser.joinedAtMs}). */
export function portalUserFirestorePayload(user: PortalUser): Record<string, unknown> {
  const { joinedAtMs: _joinedAtMs, ...rest } = user;
  return { ...rest } as Record<string, unknown>;
}
