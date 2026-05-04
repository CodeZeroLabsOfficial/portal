import type { CustomerCrmType, CustomerSubscriptionRollup } from "@/types/customer";

/** Rows for the admin customer list table (CRM-style UI). */
export interface CustomerListRow {
  /** Firestore `customers/{id}` document id. */
  id: string;
  name: string;
  email: string;
  phone: string;
  /** City, region, country — formatted for table display. */
  location: string;
  /** Legacy column; unused for CRM-only rows — show em dash. */
  gender: string;
  avatarUrl?: string;
  company?: string;
  tags: string[];
  crmType: CustomerCrmType;
  status: "active" | "archived";
  subscriptionRollup: CustomerSubscriptionRollup;
  portalUserId?: string;
  stripeCustomerId?: string;
}
