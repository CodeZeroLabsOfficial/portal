import type { ZodError } from "zod";

/**
 * Format the first issue of a Zod error as `path.to.field: message`.
 *
 * Empty path → `": message"` (preserves the legacy format used by every server
 * action since this helper was duplicated in 6 files).
 */
export function zodErrorToMessage(error: ZodError): string {
  const first = error.errors[0];
  return first ? `${first.path.join(".")}: ${first.message}` : "Invalid input";
}

/**
 * Same as {@link zodErrorToMessage} but substitutes `"input"` when the path is
 * empty. Used by opportunity-note / activity actions.
 */
export function zodFirstMessage(error: ZodError): string {
  const first = error.errors[0];
  return first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input";
}
