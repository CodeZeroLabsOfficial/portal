"use client";

import type { TaskBoardColumnId } from "@/lib/tasks/task-board-columns";
import { updateTaskBoardColumnAction } from "@/server/actions/tasks-crm";
import { useRowStatusMutation } from "@/hooks/use-row-status-mutation";

export function useTaskStatusMutation() {
  const { run, pendingId } = useRowStatusMutation(updateTaskBoardColumnAction);
  function moveToColumn(taskId: string, column: TaskBoardColumnId) {
    return run(taskId, { taskId, column });
  }
  return { moveToColumn, pendingId };
}
