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
