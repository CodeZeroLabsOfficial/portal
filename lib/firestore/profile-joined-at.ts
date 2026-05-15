import { coerceTimestampToMillis } from "@/lib/firestore/timestamp";

/**
 * Milliseconds for “when this user profile was created” — from Firestore `createdAt`
 * (Timestamp or number), else `fallbackMs` (typically `Date.now()`).
 */
export function profileJoinedAtMillisFromRawUser(
  data: Record<string, unknown> | undefined,
  fallbackMs: number,
): number {
  if (!data) return fallbackMs;
  const ms = coerceTimestampToMillis(data.createdAt);
  return ms > 0 ? ms : fallbackMs;
}
