/** Default one-time upfront charge for the 12‑month term ($1999.00). */
export const DEFAULT_PACKAGES_UPFRONT_COST_12_MINOR = 199_900;

/**
 * Package tier included-count limits use numeric fields; values at or above this
 * sentinel render as “Unlimited” in Plans UI (see default Enterprise tier).
 */
export const PACKAGE_TIER_UNLIMITED_VALUE = 1_000_000;

export function formatPackageTierIncluded(value: number | undefined): string {
  const v = value ?? 0;
  if (v >= PACKAGE_TIER_UNLIMITED_VALUE) return "Unlimited";
  return String(v);
}
