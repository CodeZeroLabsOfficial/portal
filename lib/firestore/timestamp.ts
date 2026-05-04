/**
 * Normalize Firestore timestamp values (Admin SDK, client SDK, legacy epoch ms) to milliseconds.
 * Use for reads so iOS (Timestamp) and existing web rows (number) stay compatible.
 */
export function coerceTimestampToMillis(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const tm = (value as { toMillis: () => number }).toMillis;
    if (typeof tm === "function") {
      try {
        const ms = tm.call(value);
        return typeof ms === "number" && Number.isFinite(ms) ? ms : 0;
      } catch {
        return 0;
      }
    }
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const ts = value as { seconds?: unknown; nanoseconds?: unknown };
    const seconds = ts.seconds;
    const nanoseconds = typeof ts.nanoseconds === "number" ? ts.nanoseconds : 0;
    if (typeof seconds === "number" && Number.isFinite(seconds)) {
      return seconds * 1000 + Math.floor(nanoseconds / 1e6);
    }
  }
  return 0;
}
