import { utcDateIsoFromMillis } from "@/lib/date-utc-iso";
import type { AgreementSubscriptionStartDateMode } from "@/types/proposal";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function parseIsoDateToUtcMs(iso: string): number | null {
  const match = ISO_DATE_RE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return ms;
}

function addUtcDaysClamped(baseMs: number, days: number): number {
  return baseMs + days * DAY_MS;
}

function addUtcMonthsClamped(startMs: number, months: number): number {
  const start = new Date(startMs);
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();
  const startDay = start.getUTCDate();
  const targetMonthIndex = startMonth + months;
  const targetYear = startYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const targetMonthLastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(startDay, targetMonthLastDay);
  return Date.UTC(targetYear, targetMonth, targetDay, 0, 0, 0, 0);
}

export const AGREEMENT_SUBSCRIPTION_START_DATE_MODE_OPTIONS: ReadonlyArray<{
  value: AgreementSubscriptionStartDateMode;
  label: string;
}> = [
  { value: "on_acceptance", label: "On acceptance (same day)" },
  { value: "delay_1_day", label: "1 day after acceptance" },
  { value: "delay_1_week", label: "1 week after acceptance" },
  { value: "delay_1_month", label: "1 month after acceptance" },
  { value: "custom", label: "Custom date" },
] as const;

export function defaultAgreementSubscriptionStartCustomDate(): string {
  return utcDateIsoFromMillis(Date.now());
}

export function resolveAgreementSubscriptionStartDateIso(params: {
  mode?: AgreementSubscriptionStartDateMode;
  customDateIso?: string;
  acceptedAtMs: number;
}): { ok: true; startDateIso: string } | { ok: false; message: string } {
  const mode = params.mode ?? "on_acceptance";
  const acceptanceIso = utcDateIsoFromMillis(params.acceptedAtMs);
  const acceptanceMs = parseIsoDateToUtcMs(acceptanceIso);
  if (acceptanceMs === null) {
    return { ok: false, message: "Invalid acceptance timestamp." };
  }

  if (mode === "custom") {
    const custom = params.customDateIso?.trim();
    if (!custom || !ISO_DATE_RE.test(custom)) {
      return { ok: false, message: "Set a custom subscription start date on the Accept block." };
    }
    if (parseIsoDateToUtcMs(custom) === null) {
      return { ok: false, message: "Invalid custom subscription start date." };
    }
    return { ok: true, startDateIso: custom };
  }

  let startMs = acceptanceMs;
  switch (mode) {
    case "on_acceptance":
      break;
    case "delay_1_day":
      startMs = addUtcDaysClamped(acceptanceMs, 1);
      break;
    case "delay_1_week":
      startMs = addUtcDaysClamped(acceptanceMs, 7);
      break;
    case "delay_1_month":
      startMs = addUtcMonthsClamped(acceptanceMs, 1);
      break;
    default:
      return { ok: false, message: "Invalid subscription start date setting." };
  }

  return { ok: true, startDateIso: utcDateIsoFromMillis(startMs) };
}
