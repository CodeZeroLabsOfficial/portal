export interface SubscriptionDurationOption {
  months: number;
  priceId: string;
  currency: string;
  unitAmountMinor: number;
}

export interface SubscriptionProductOption {
  productId: string;
  productName: string;
  durations: SubscriptionDurationOption[];
}
