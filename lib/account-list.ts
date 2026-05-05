/** One row per distinct company name on the Accounts directory page. */
export interface AccountListRow {
  key: string;
  displayName: string;
  /** Single-line summary for the table (street + city / country when present). */
  addressSummary: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  contactCount: number;
  activeContactCount: number;
}
