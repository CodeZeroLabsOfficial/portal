/**
 * Firestore rejects `undefined` anywhere under a document — strip before `set` / `update`.
 */
export function omitUndefinedDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedDeep(item));
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = omitUndefinedDeep(v);
  }
  return out;
}
