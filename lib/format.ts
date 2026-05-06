import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/lib/constants";

export function formatCurrencyAmount(
  amountMinorUnits: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMinorUnits / 100);
}

/**
 * Normalize a user-provided website value into an absolute URL. Empty strings
 * stay empty so the caller can hide the link entirely.
 */
export function websiteHref(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * Initials for an avatar fallback (1–2 uppercase letters). Returns `"?"` for
 * empty/whitespace-only names.
 *
 * Examples: `"John Smith"` → `"JS"`, `"Jane"` → `"JA"`, `""` → `"?"`.
 */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/**
 * Standard address fields shared by accounts/companies/users — pass an object
 * with whichever subset of fields is available. All fields are optional and
 * empty/whitespace values are trimmed out.
 */
export interface AddressFields {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Format an address as 1–3 display lines (Line 1, Line 2, "City, Region Postal,
 * Country"). Returns an empty array when no address fields are populated.
 */
export function formatAddressLines(a: AddressFields): string[] {
  const lines: string[] = [];
  if (a.addressLine1?.trim()) lines.push(a.addressLine1.trim());
  if (a.addressLine2?.trim()) lines.push(a.addressLine2.trim());
  const locality = [
    [a.city, a.region].filter(Boolean).join(", "),
    a.postalCode,
  ]
    .filter(Boolean)
    .join(" ");
  const tail = [locality, a.country?.trim()].filter(Boolean).join(", ");
  if (tail) lines.push(tail);
  return lines;
}
