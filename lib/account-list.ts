/** One row per distinct company name on the Accounts directory page. */
export interface AccountListRow {
  key: string;
  displayName: string;
  /** Single-line summary for the table (street + city / country when present). */
  addressSummary: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  /** Newest active contact name, or newest contact when none are active. */
  contactName: string;
  /** Customer record id for the displayed contact, when present. */
  contactId?: string;
  /** Additional contacts beyond `contactName` (0 when only one or none). */
  additionalContactCount: number;
}
