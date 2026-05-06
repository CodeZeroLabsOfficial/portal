"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { TASK_BOARD_COLUMNS, type TaskBoardColumnId } from "@/lib/tasks/task-board-columns";
import { TASK_PRIORITY_VALUES, type TaskPriorityValue } from "@/lib/tasks/task-priority";
import {
  createTaskForStaff,
  deleteTaskForStaff,
  listAssignableUsersForStaff,
  updateTaskBoardColumn,
  updateTaskForStaff,
} from "@/server/firestore/crm-tasks";

const taskPriorityZodEnum = TASK_PRIORITY_VALUES as unknown as [
  TaskPriorityValue,
  ...TaskPriorityValue[],
];

const taskBoardColumnZodEnum = TASK_BOARD_COLUMNS as unknown as [
  TaskBoardColumnId,
  ...TaskBoardColumnId[],
];

async function requireStaffForCrm() {
  const user = await getCurrentSessionUser();
  if (!user || !hasRole(user, ["admin", "team"])) return null;
  return user;
}

const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  column: z.enum(taskBoardColumnZodEnum),
});

export async function updateTaskBoardColumnAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = updateTaskStatusSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, message: first ? first.message : "Invalid input" };
  }

  const res = await updateTaskBoardColumn(user, parsed.data.taskId, parsed.data.column);
  if (!res.ok) return res;

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/customers", "layout");
  return { ok: true };
}

const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(500),
  description: z.string().trim().max(8000).optional(),
  column: z.enum(taskBoardColumnZodEnum),
  assignedToUid: z.string().min(1).optional(),
  priority: z.enum(taskPriorityZodEnum),
  progressPercent: z.number().int().min(0).max(100),
});

export async function createTaskAction(
  raw: unknown,
): Promise<{ ok: true; taskId: string } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, message: first ? first.message : "Invalid input" };
  }

  const res = await createTaskForStaff(user, {
    title: parsed.data.title,
    description: parsed.data.description || undefined,
    column: parsed.data.column,
    assignedToUid: parsed.data.assignedToUid,
    priority: parsed.data.priority,
    progressPercent: parsed.data.progressPercent,
  });
  if (!res.ok) return res;

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/customers", "layout");
  return { ok: true, taskId: res.taskId };
}

const updateTaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required.").max(500),
  description: z.string().trim().max(8000).optional(),
  column: z.enum(taskBoardColumnZodEnum),
  assignedToUid: z.string().min(1).optional(),
  priority: z.enum(taskPriorityZodEnum),
  progressPercent: z.number().int().min(0).max(100),
});

export async function updateTaskAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, message: first ? first.message : "Invalid input" };
  }

  const res = await updateTaskForStaff(user, parsed.data.taskId, {
    title: parsed.data.title,
    description: parsed.data.description || undefined,
    column: parsed.data.column,
    assignedToUid: parsed.data.assignedToUid,
    priority: parsed.data.priority,
    progressPercent: parsed.data.progressPercent,
  });
  if (!res.ok) return res;

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/customers", "layout");
  return { ok: true };
}

export async function listTaskAssigneeOptionsAction(): Promise<
  { ok: true; options: Array<{ uid: string; displayName: string; email: string }> } | { ok: false; message: string }
> {
  const user = await requireStaffForCrm();
  if (!user) return { ok: false, message: "Unauthorized." };
  const options = await listAssignableUsersForStaff(user);
  return { ok: true, options };
}

export async function deleteTaskAction(
  taskId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
  if (!user) return { ok: false, message: "Unauthorized." };
  const trimmed = taskId?.trim();
  if (!trimmed) return { ok: false, message: "Invalid task." };
  const res = await deleteTaskForStaff(user, trimmed);
  if (!res.ok) return res;
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/customers", "layout");
  return { ok: true };
}
