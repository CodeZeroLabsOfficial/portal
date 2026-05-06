import { FieldValue } from "firebase-admin/firestore";
import { logError } from "@/lib/logging";
import { COLLECTIONS } from "@/server/firestore/collections";
import { parseTaskRecord } from "@/server/firestore/parse-task";
import type { TaskBoardColumnId } from "@/lib/tasks/task-board-columns";
import { boardColumnToStatus } from "@/lib/tasks/task-board-columns";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import type { TaskRecord } from "@/types/task";
import type { PortalUser } from "@/types/user";

function canStaffAccessCrm(user: PortalUser): boolean {
  return user.role === "admin" || user.role === "team";
}

function taskAccessibleByOrg(task: TaskRecord, user: PortalUser): boolean {
  if (!user.organizationId) return true;
  return task.organizationId === user.organizationId;
}

async function getTaskForStaff(user: PortalUser, taskId: string): Promise<TaskRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return null;
  const snap = await db.collection(COLLECTIONS.tasks).doc(taskId).get();
  if (!snap.exists) return null;
  const row = parseTaskRecord(snap.id, snap.data() as Record<string, unknown>);
  return taskAccessibleByOrg(row, user) ? row : null;
}

export async function listTasksForStaff(user: PortalUser): Promise<TaskRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return [];
  try {
    if (!user.organizationId) return [];
    const snap = await db
      .collection(COLLECTIONS.tasks)
      .where("organizationId", "==", user.organizationId)
      .limit(200)
      .get();
    return snap.docs
      .map((d) => parseTaskRecord(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch (error) {
    logError("crm_list_tasks_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export async function updateTaskBoardColumn(
  user: PortalUser,
  taskId: string,
  column: TaskBoardColumnId,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return { ok: false, message: "Not allowed." };
  const existing = await getTaskForStaff(user, taskId);
  if (!existing) return { ok: false, message: "Task not found." };

  await db
    .collection(COLLECTIONS.tasks)
    .doc(taskId)
    .update({
      status: boardColumnToStatus(column),
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
    });

  return { ok: true };
}
