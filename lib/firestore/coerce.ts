/**
 * Shared Firestore field coercion helpers — used by every parser/firestore reader.
 *
 * Behavior is intentionally permissive (kept identical to the inline copies that
 * previously lived in each `server/firestore/*.ts` file): `asString` rejects
 * empty strings only, `asNumber` requires a finite number.
 */

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Parse a string→string map from raw Firestore data (used for `customFields`,
 * `customFieldsSnapshot`, etc.). Drops non-string entries and returns `{}` for
 * anything that isn't a plain object.
 */
export function asStringStringMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === "string" && typeof v === "string") out[k] = v;
  }
  return out;
}
