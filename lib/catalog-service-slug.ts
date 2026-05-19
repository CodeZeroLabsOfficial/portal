/** Stable slug for Stripe lookup keys (`{slug}_12_months`). */
export function slugifyCatalogServiceName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base.length > 0 ? base : "service";
}

export function catalogServicePriceLookupKey(slug: string, months: 12 | 24): string {
  return `${slug}_${months}_months`;
}
