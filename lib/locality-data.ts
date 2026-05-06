import { ISO3166_ALPHA2_CODES } from "@/lib/iso3166-alpha2-codes";

export function getAllTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone").sort((a, b) => a.localeCompare(b));
  } catch {
    return ["UTC", "Australia/Sydney", "Pacific/Auckland", "America/New_York", "Europe/London"];
  }
}

export function getAllCurrencyCodes(): string[] {
  try {
    return Intl.supportedValuesOf("currency").sort((a, b) => a.localeCompare(b));
  } catch {
    return ["AUD", "USD", "EUR", "GBP", "NZD"];
  }
}

export function isIso3166Alpha2(code: string): boolean {
  return (ISO3166_ALPHA2_CODES as readonly string[]).includes(code);
}

/** BCP 47 language tags most commonly used in the portal. */
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-NZ", label: "English (New Zealand)" },
  { value: "en", label: "English (generic)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "fr-CA", label: "French (Canada)" },
  { value: "de", label: "German" },
  { value: "de-AT", label: "German (Austria)" },
  { value: "es", label: "Spanish" },
  { value: "es-MX", label: "Spanish (Mexico)" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "pt-PT", label: "Portuguese (Portugal)" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "zh-TW", label: "Chinese (Traditional)" },
  { value: "hi", label: "Hindi" },
  { value: "th", label: "Thai" },
  { value: "vi", label: "Vietnamese" },
  { value: "id", label: "Indonesian" },
  { value: "ms", label: "Malay" },
  { value: "fil", label: "Filipino" },
].sort((a, b) => a.label.localeCompare(b.label));

export const DATE_FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: "locale", label: "Match language and region" },
  { value: "iso", label: "ISO (YYYY-MM-DD)" },
  { value: "dmy", label: "Day / month / year (DD/MM/YYYY)" },
  { value: "mdy", label: "Month / day / year (MM/DD/YYYY)" },
  { value: "long", label: "Long text (6 May 2026)" },
];

export const TIME_FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: "12", label: "12-hour (3:30 pm)" },
  { value: "24", label: "24-hour (15:30)" },
];
