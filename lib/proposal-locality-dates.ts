/**
 * Helpers for proposal-related dates using the IANA time zone from Settings → Locality (`PortalUser.timeZone`).
 */

/** Return trimmed IANA id when `Intl` accepts it; otherwise `undefined`. */
export function normalizeLocalityTimeZone(raw?: string | null): string | undefined {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return undefined;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return t;
  } catch {
    return undefined;
  }
}

/** `YYYY-MM-DD` for “today” in `timeZone`, or the runtime’s local calendar when unset. */
export function todayIsoDateInTimeZone(timeZone?: string): string {
  const tz = normalizeLocalityTimeZone(timeZone);
  const now = new Date();
  if (!tz) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A UTC instant whose calendar date in `timeZone` equals `isoDate` (`YYYY-MM-DD`). */
function utcInstantOnLocalCalendarDate(isoDate: string, timeZone: string): Date {
  const [Y, M, D] = isoDate.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(Y) || !Number.isFinite(M) || !Number.isFinite(D)) {
    return new Date();
  }
  const calFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const t0 = Date.UTC(Y, M - 1, D, 15, 0, 0, 0);
  for (let h = -24; h <= 24; h++) {
    const t = t0 + h * 3600_000;
    if (calFmt.format(t) === isoDate) return new Date(t);
  }
  return new Date(Date.UTC(Y, M - 1, D, 12, 0, 0, 0));
}

/**
 * Long formatted calendar label for a date-picker value (`YYYY-MM-DD`) in the locality zone.
 * When `timeZone` is omitted, matches previous behaviour (local noon, browser locale).
 */
export function formatIsoCalendarDateLong(
  isoDate: string,
  timeZone?: string,
  locale?: Intl.LocalesArgument,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const tz = normalizeLocalityTimeZone(timeZone);
  if (!tz) {
    const d = new Date(`${isoDate}T12:00:00`);
    return d.toLocaleDateString(locale ?? undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const instant = utcInstantOnLocalCalendarDate(isoDate, tz);
  return instant.toLocaleDateString(locale ?? undefined, {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** `{{date}}`-style long date in en-AU for an instant, optionally in a fixed IANA zone. */
export function formatProposalMergeDate(at: Date, timeZone?: string): string {
  const tz = normalizeLocalityTimeZone(timeZone);
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "long" };
  if (tz) opts.timeZone = tz;
  try {
    return at.toLocaleDateString("en-AU", opts);
  } catch {
    return at.toLocaleDateString("en-AU", { dateStyle: "long" });
  }
}

export function formatLastEditedInLocality(ms: number, timeZone?: string): string {
  if (!ms) return "—";
  const tz = normalizeLocalityTimeZone(timeZone);
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  if (tz) opts.timeZone = tz;
  try {
    return new Intl.DateTimeFormat(undefined, opts).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}
