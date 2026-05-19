/** Portal-owned sellable service — synced to Stripe on activate. */
export type CatalogServiceStatus = "draft" | "active" | "archived";

export type CatalogServiceTermMonths = 12 | 24;

export interface CatalogServiceTerm {
  months: CatalogServiceTermMonths;
  /** Recurring per-month amount in minor units (display + Stripe unit_amount). */
  monthlyAmountMinor: number;
  /** Set after Stripe sync (`price_…`). */
  stripePriceId?: string;
}

export interface CatalogServiceRecord {
  id: string;
  organizationId: string;
  createdByUid: string;
  name: string;
  /** Used for Stripe Price `lookup_key` prefix (e.g. `starter_12_months`). */
  slug: string;
  status: CatalogServiceStatus;
  currency: string;
  sortOrder: number;
  includedUsers: number;
  includedLocations: number;
  includedAdmins: number;
  upfrontCost12Minor?: number;
  features: string[];
  terms: CatalogServiceTerm[];
  stripeProductId?: string;
  stripeSyncedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Picker shape for subscriptions UI and proposal tier linking. */
export interface CatalogServicePickerOption {
  serviceId: string;
  serviceName: string;
  currency: string;
  status: CatalogServiceStatus;
  durations: Array<{
    months: CatalogServiceTermMonths;
    priceId: string;
    currency: string;
    unitAmountMinor: number;
  }>;
  includedUsers: number;
  includedLocations: number;
  includedAdmins: number;
  upfrontCost12Minor?: number;
  features: string[];
}
