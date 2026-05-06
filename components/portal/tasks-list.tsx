"use client";

import Link from "next/link";
import {
  TASK_BOARD_COLUMNS,
  statusToBoardColumn,
  taskBoardColumnLabel,
  type TaskBoardColumnId,
} from "@/lib/tasks/task-board-columns";
import type { TaskRecord } from "@/types/task";
import { useTaskStatusMutation } from "@/hooks/use-task-status-mutation";
import { cn } from "@/lib/utils";

export interface TasksListProps {
  tasks: TaskRecord[];
}

export function TasksList({ tasks }: TasksListProps) {
  const { moveToColumn, pendingId } = useTaskStatusMutation();

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Column</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No tasks yet. Add documents to the <span className="font-mono">tasks</span> collection for this
                  organization.
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 align-middle">
                    <div className="font-medium">{task.title}</div>
                    {task.description ? (
                      <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{task.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <select
                      value={statusToBoardColumn(task.status)}
                      disabled={pendingId === task.id}
                      onChange={(e) => {
                        const next = e.target.value as TaskBoardColumnId;
                        const current = statusToBoardColumn(task.status);
                        if (next !== current) void moveToColumn(task.id, next);
                      }}
                      className={cn(
                        "h-9 max-w-[200px] rounded-md border border-border/80 bg-background px-2 text-[13px]",
                        pendingId === task.id && "opacity-60",
                      )}
                      aria-label={`Column for ${task.title}`}
                    >
                      {TASK_BOARD_COLUMNS.map((c) => (
                        <option key={c} value={c}>
                          {taskBoardColumnLabel(c)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 align-middle text-muted-foreground tabular-nums">
                    {new Date(task.updatedAtMs).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {task.customerId ? (
                      <Link
                        href={`/admin/customers/${task.customerId}`}
                        className="font-mono text-[12px] text-primary underline-offset-4 hover:underline"
                      >
                        {task.customerId.slice(0, 10)}…
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
