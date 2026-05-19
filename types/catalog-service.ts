/** Portal-owned sellable service — synced to Stripe on activate. */
export type CatalogServiceStatus = "draft" | "active" | "archived";

export type CatalogServiceKind = "plan" | "addon";

/** How the customer is charged in Stripe. */
export type CatalogServiceBillingType = "recurring" | "one_off";

/** `flat` = one price; `by_term` = separate 12- and 24-month prices (plans). */
export type CatalogServicePricingModel = "flat" | "by_term";

export type CatalogServiceTermMonths = 12 | 24;

export interface CatalogServiceTerm {
  /** Set for `by_term` pricing; omitted for flat / one-off. */
  months?: CatalogServiceTermMonths;
  /** Recurring per-month or one-off amount in minor units (Stripe `unit_amount`). */
  monthlyAmountMinor: number;
  /** Set after Stripe sync (`price_…`). */
  stripePriceId?: string;
  /** Stripe Price `lookup_key` for this term. */
  lookupKey?: string;
}

export interface CatalogServiceRecord {
  id: string;
  organizationId: string;
  createdByUid: string;
  name: string;
  /** Base segment for Stripe lookup keys (e.g. `professional` → `professional_plan_12_months`). */
  slug: string;
  /** Omitted on pre-migration documents (legacy `{slug}_12_months` keys). */
  serviceType?: CatalogServiceKind;
  description?: string;
  billingType?: CatalogServiceBillingType;
  pricingModel?: CatalogServicePricingModel;
  status: CatalogServiceStatus;
  currency: string;
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
  serviceType?: CatalogServiceKind;
  billingType?: CatalogServiceBillingType;
  pricingModel?: CatalogServicePricingModel;
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
