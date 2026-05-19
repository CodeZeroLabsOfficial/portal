/** Default one-time upfront charge for the 12‑month term ($1999.00). */
export const DEFAULT_PACKAGES_UPFRONT_COST_12_MINOR = 199_900;

export function formatPackageTierIncluded(value: number | undefined): string {
  const v = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  if (v === 0) return "Unlimited";
  return String(v);
}
