export type UserRole = "admin" | "team" | "customer";

/** Mirrors `users/{uid}` in Firestore — align fields with your iOS app where possible. */
export interface PortalUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  /** Owning organisation or tenant id for team/admin scoping. */
  organizationId?: string;
  /** Stripe Customer id for billing portal and invoices. */
  stripeCustomerId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  website?: string;
  /** Stored as YYYY-MM-DD. */
  dateOfBirth?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  /** IANA time zone for scheduling and display, e.g. Australia/Sydney. */
  timeZone?: string;
  /** BCP 47 language tag for UI and formatting, e.g. en-AU. */
  languageTag?: string;
  /** Date display style: locale, iso, dmy, mdy, long, or empty for app default. */
  dateFormatPreset?: string;
  /** 12, 24, or empty for app default. */
  timeFormatPreset?: string;
  /** ISO 3166-1 alpha-2 region for locale conventions, e.g. AU. */
  localeRegionCode?: string;
  /** ISO 4217 currency for display, e.g. AUD. */
  currencyCode?: string;
  createdAtMs: number;
  updatedAtMs: number;
}
