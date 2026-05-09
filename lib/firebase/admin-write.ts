import { logError, type LogFields } from "@/lib/logging";

/**
 * Wraps a Firestore admin write so that:
 *  - The write's exception is caught and logged with a structured tag.
 *  - In development, the underlying message is surfaced to the caller so the
 *    UI can show the real cause (e.g. an admin-SDK validation error).
 *  - In production, callers see only a generic friendly message.
 *
 * Usage:
 *
 *   const result = await runAdminWrite(
 *     "proposal_send_failed",
 *     { proposalId },
 *     "Could not publish proposal.",
 *     () => ref.update({ ... }),
 *   );
 *   if (!result.ok) return result;
 *
 * Returns `{ ok: true; value }` on success or `{ ok: false; message }` on
 * failure, ready to forward through a Server Action.
 */
export async function runAdminWrite<T>(
  tag: string,
  context: LogFields,
  friendly: string,
  op: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    return { ok: true, value: await op() };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    logError(tag, { ...context, message: reason });
    const detail =
      process.env.NODE_ENV === "production" ? friendly : `${friendly} ${reason}`;
    return { ok: false, message: detail };
  }
}
