import { Timestamp } from "firebase-admin/firestore";

/**
 * Milliseconds for “when this user profile was created” — from Firestore `createdAt` (Timestamp),
 * else legacy `createdAtMs`, else `fallbackMs` (typically `Date.now()`).
 */
export function profileJoinedAtMillisFromRawUser(
  data: Record<string, unknown> | undefined,
  fallbackMs: number,
): number {
  if (!data) return fallbackMs;
  const ca = data.createdAt;
  if (
    ca &&
    typeof ca === "object" &&
    "toMillis" in ca &&
    typeof (ca as Timestamp).toMillis === "function"
  ) {
    return (ca as Timestamp).toMillis();
  }
  const legacy = data.createdAtMs;
  if (typeof legacy === "number" && Number.isFinite(legacy)) {
    return legacy;
  }
  return fallbackMs;
}
