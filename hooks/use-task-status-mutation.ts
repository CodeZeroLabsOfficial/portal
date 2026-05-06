"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { TaskBoardColumnId } from "@/lib/tasks/task-board-columns";
import { updateTaskBoardColumnAction } from "@/server/actions/tasks-crm";

export function useTaskStatusMutation() {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function moveToColumn(taskId: string, column: TaskBoardColumnId) {
    setPendingId(taskId);
    const res = await updateTaskBoardColumnAction({ taskId, column });
    setPendingId(null);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.refresh();
  }

  return { moveToColumn, pendingId };
}
