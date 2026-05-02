/** Rows for the admin customer list table (CRM-style UI). */

export interface CustomerListRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  gender: string;
  avatarUrl?: string;
}
