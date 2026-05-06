import { coerceTimestampToMillis } from "@/lib/firestore/timestamp";
import type { TaskRecord } from "@/types/task";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Normalizes reads from Admin SDK Timestamp, legacy ms, optional fields. */
export function parseTaskRecord(id: string, data: Record<string, unknown>): TaskRecord {
  const progressRaw = asNumber(data.progressPercent ?? data.progress);
  let progressPercent: number | undefined;
  if (typeof progressRaw === "number") {
    progressPercent = Math.min(100, Math.max(0, Math.round(progressRaw)));
  }

  return {
    id,
    organizationId: asString(data.organizationId),
    customerId: asString(data.customerId),
    title: asString(data.title) ?? "Task",
    status: asString(data.status) ?? "open",
    dueAtMs: asNumber(data.dueAtMs),
    startAtMs: asNumber(data.startAtMs),
    updatedAtMs: coerceTimestampToMillis(data.updatedAt ?? data.updatedAtMs) || Date.now(),
    description: asString(data.description),
    priority: asString(data.priority),
    category: asString(data.category),
    progressPercent,
    commentCount: asNumber(data.commentCount),
    attachmentCount: asNumber(data.attachmentCount),
    assigneeCount: asNumber(data.assigneeCount),
    assignedToUid: asString(data.assignedToUid),
  };
}
