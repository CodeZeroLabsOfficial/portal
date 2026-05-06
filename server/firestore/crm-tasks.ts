import { FieldValue } from "firebase-admin/firestore";
import { logError } from "@/lib/logging";
import { COLLECTIONS } from "@/server/firestore/collections";
import { parseTaskRecord } from "@/server/firestore/parse-task";
import type { TaskBoardColumnId } from "@/lib/tasks/task-board-columns";
import { boardColumnToStatus } from "@/lib/tasks/task-board-columns";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import type { TaskRecord } from "@/types/task";
import type { PortalUser } from "@/types/user";
import { DEFAULT_TASK_PRIORITY } from "@/lib/tasks/task-priority";

export interface TaskAssigneeOption {
  uid: string;
  displayName: string;
  email: string;
}

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

export async function updateTaskForStaff(
  user: PortalUser,
  taskId: string,
  input: {
    title: string;
    description?: string;
    column: TaskBoardColumnId;
    assignedToUid?: string;
    priority?: string;
    progressPercent?: number;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return { ok: false, message: "Not allowed." };
  const existing = await getTaskForStaff(user, taskId);
  if (!existing) return { ok: false, message: "Task not found." };

  const title = input.title.trim();
  if (!title) return { ok: false, message: "Title is required." };

  const descTrimmed = input.description?.trim() ?? "";
  const priority =
    typeof input.priority === "string" && input.priority.trim().length > 0
      ? input.priority.trim().toLowerCase()
      : DEFAULT_TASK_PRIORITY;
  const progressPercent =
    typeof input.progressPercent === "number" && Number.isFinite(input.progressPercent)
      ? Math.min(100, Math.max(0, Math.round(input.progressPercent)))
      : 0;

  const payload: Record<string, unknown> = {
    title,
    status: boardColumnToStatus(input.column),
    priority,
    progressPercent,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: Date.now(),
  };
  if (descTrimmed.length > 0) {
    payload.description = descTrimmed;
  } else {
    payload.description = FieldValue.delete();
  }
  if (input.assignedToUid !== undefined) {
    if (input.assignedToUid) {
      payload.assignedToUid = input.assignedToUid;
      payload.assigneeCount = 1;
    } else {
      payload.assignedToUid = FieldValue.delete();
      payload.assigneeCount = 0;
    }
  }

  await db.collection(COLLECTIONS.tasks).doc(taskId).update(payload);

  return { ok: true };
}

export async function createTaskForStaff(
  user: PortalUser,
  input: {
    title: string;
    description?: string;
    column: TaskBoardColumnId;
    assignedToUid?: string;
    priority?: string;
    progressPercent?: number;
  },
): Promise<{ ok: true; taskId: string } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) {
    return { ok: false, message: "Not allowed." };
  }
  if (!user.organizationId) {
    return { ok: false, message: "Your profile needs an organization id to create tasks." };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false, message: "Title is required." };
  }

  const description = input.description?.trim();
  const now = Date.now();

  const priority =
    typeof input.priority === "string" && input.priority.trim().length > 0
      ? input.priority.trim().toLowerCase()
      : DEFAULT_TASK_PRIORITY;

  const progressPercent =
    typeof input.progressPercent === "number" && Number.isFinite(input.progressPercent)
      ? Math.min(100, Math.max(0, Math.round(input.progressPercent)))
      : 0;

  const docRef = await db.collection(COLLECTIONS.tasks).add({
    organizationId: user.organizationId,
    title,
    description: description || undefined,
    status: boardColumnToStatus(input.column),
    priority,
    progressPercent,
    assignedToUid: input.assignedToUid || user.uid,
    assigneeCount: 1,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
  });

  return { ok: true, taskId: docRef.id };
}

export async function listAssignableUsersForStaff(user: PortalUser): Promise<TaskAssigneeOption[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user) || !user.organizationId) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.users)
      .where("organizationId", "==", user.organizationId)
      .where("role", "in", ["admin", "team"])
      .limit(200)
      .get();

    return snap.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const displayName =
          (typeof data.displayName === "string" && data.displayName.trim()) ||
          (typeof data.email === "string" && data.email.trim()) ||
          doc.id;
        const email = typeof data.email === "string" ? data.email : "";
        return { uid: doc.id, displayName, email };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
  } catch (error) {
    logError("crm_list_assignable_users_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export async function deleteTaskForStaff(
  user: PortalUser,
  taskId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return { ok: false, message: "Not allowed." };
  const existing = await getTaskForStaff(user, taskId);
  if (!existing) return { ok: false, message: "Task not found." };
  await db.collection(COLLECTIONS.tasks).doc(taskId).delete();
  return { ok: true };
}
