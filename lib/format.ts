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

/** Multi-line address block for inline edit display (round-trips with {@link addressFieldsFromBlock}). */
export function addressBlockFromFields(a: AddressFields): string {
  return formatAddressLines(a).join("\n");
}

const EMPTY_ADDRESS: AddressFields = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

function trimField(v: string | undefined): string {
  return v?.trim() ?? "";
}

/** True when `line` looks like "City, Region Postcode, Country" rather than a street line 2. */
export function looksLikeLocalityLine(line: string): boolean {
  const t = line.trim();
  if (!t.includes(",")) return false;
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return true;
  if (/\b\d{4}\b/.test(t)) return true;
  return false;
}

/**
 * Parses a single locality line such as "Docklands, VIC 3008, Australia" into
 * city / region / postalCode / country (best-effort, AU-friendly).
 */
export function parseLocalityLine(line: string): Pick<AddressFields, "city" | "region" | "postalCode" | "country"> {
  const trimmed = line.trim();
  if (!trimmed) {
    return { city: "", region: "", postalCode: "", country: "" };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { city: "", region: "", postalCode: "", country: "" };
  }
  if (parts.length === 1) {
    return { city: parts[0], region: "", postalCode: "", country: "" };
  }

  const country = parts[parts.length - 1] ?? "";
  const city = parts[0] ?? "";

  if (parts.length === 2) {
    return { city, region: "", postalCode: "", country };
  }

  const middle = parts.slice(1, -1).join(", ");
  const regionPostal = middle.match(/^(.+?)\s+(\d[\d\s-]{2,})$/);
  if (regionPostal) {
    return {
      city,
      region: regionPostal[1].trim(),
      postalCode: regionPostal[2].replace(/\s/g, ""),
      country,
    };
  }

  return { city, region: middle, postalCode: "", country };
}

/**
 * Ensures contact-style addresses use separate city/region/postalCode/country fields
 * when locality was stored on line 2 (legacy paste / multiline edit).
 */
export function normalizeAddressFields(fields: AddressFields): AddressFields {
  const line1 = trimField(fields.addressLine1);
  let line2 = trimField(fields.addressLine2);
  let city = trimField(fields.city);
  let region = trimField(fields.region);
  let postalCode = trimField(fields.postalCode);
  let country = trimField(fields.country);

  const structuredEmpty = !city && !region && !postalCode && !country;

  if (structuredEmpty && line2 && looksLikeLocalityLine(line2)) {
    const parsed = parseLocalityLine(line2);
    city = trimField(parsed.city);
    region = trimField(parsed.region);
    postalCode = trimField(parsed.postalCode);
    country = trimField(parsed.country);
    line2 = "";
  }

  return {
    addressLine1: line1,
    addressLine2: line2,
    city,
    region,
    postalCode,
    country,
  };
}

/** Parses a multi-line address block back into structured fields (round-trips with {@link formatAddressLines}). */
export function addressFieldsFromBlock(text: string): AddressFields {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { ...EMPTY_ADDRESS };
  }

  const addressLine1 = lines[0] ?? "";
  let addressLine2 = "";
  let localityLine = "";

  if (lines.length === 1) {
    return normalizeAddressFields({ ...EMPTY_ADDRESS, addressLine1 });
  }

  if (lines.length === 2) {
    if (looksLikeLocalityLine(lines[1])) {
      localityLine = lines[1];
    } else {
      addressLine2 = lines[1];
    }
  } else {
    addressLine2 = lines[1] ?? "";
    localityLine = lines.slice(2).join(", ");
  }

  const parsed = localityLine ? parseLocalityLine(localityLine) : { city: "", region: "", postalCode: "", country: "" };

  return normalizeAddressFields({
    addressLine1,
    addressLine2,
    city: parsed.city,
    region: parsed.region,
    postalCode: parsed.postalCode,
    country: parsed.country,
  });
}
