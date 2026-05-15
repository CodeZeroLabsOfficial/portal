import { asNumber, asString } from "@/lib/firestore/coerce";
import { millisFromFirestore } from "@/lib/firestore/timestamp";
import type { TaskRecord } from "@/types/task";

/** Normalizes reads from Admin SDK Timestamp or epoch ms, optional fields. */
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
    dueAt: asNumber(data.dueAt),
    startAt: asNumber(data.startAt),
    updatedAt: millisFromFirestore(data, "updatedAt") || Date.now(),
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
