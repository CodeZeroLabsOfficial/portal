"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { TASK_BOARD_COLUMNS, type TaskBoardColumnId } from "@/lib/tasks/task-board-columns";
import { updateTaskBoardColumn } from "@/server/firestore/crm-tasks";

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
