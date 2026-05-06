"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateTaskAction } from "@/server/actions/tasks-crm";
import {
  TASK_BOARD_COLUMNS,
  statusToBoardColumn,
  taskBoardColumnLabel,
  type TaskBoardColumnId,
} from "@/lib/tasks/task-board-columns";
import {
  DEFAULT_TASK_PRIORITY,
  TASK_PRIORITY_VALUES,
  coerceTaskPriority,
  taskPriorityLabel,
  type TaskPriorityValue,
} from "@/lib/tasks/task-priority";
import { clampProgressPercent, TASK_PROGRESS_PERCENT_OPTIONS } from "@/lib/tasks/task-progress-options";
import type { TaskRecord } from "@/types/task";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormServerError } from "@/components/ui/form-server-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskRecord | null;
}

export function EditTaskDialog({ open, onOpenChange, task }: EditTaskDialogProps) {
  const router = useRouter();
  const [column, setColumn] = React.useState<TaskBoardColumnId>("todo");
  const [title, setTitle] = React.useState("");
  const [priority, setPriority] = React.useState<TaskPriorityValue>(DEFAULT_TASK_PRIORITY);
  const [progressPercent, setProgressPercent] = React.useState(0);
  const [description, setDescription] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setPriority(coerceTaskPriority(task.priority));
    setProgressPercent(clampProgressPercent(task.progressPercent));
    setDescription(task.description ?? "");
    setColumn(statusToBoardColumn(task.status));
    setServerError(null);
  }, [open, task?.id]);

  React.useEffect(() => {
    if (!open) {
      setServerError(null);
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    setServerError(null);
    setPending(true);
    const res = await updateTaskAction({
      taskId: task.id,
      title,
      description: description.trim() || undefined,
      column,
      priority,
      progressPercent,
    });
    setPending(false);
    if (!res.ok) {
      setServerError(res.message);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  const busy = pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,800px)] w-[min(100vw-2rem,520px)] max-w-[520px] overflow-y-auto border-white/[0.08] bg-[#141414] p-0 sm:max-w-[520px]">
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">Edit task</DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 px-6 py-5" noValidate>
          <FormServerError message={serverError} rounded="xl" />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-task-title" className="text-zinc-300">
              Title
            </Label>
            <Input
              id="edit-task-title"
              name="title"
              required
              maxLength={500}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design new landing page"
              autoComplete="off"
              disabled={busy || !task}
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-task-priority" className="text-zinc-300">
              Priority
            </Label>
            <select
              id="edit-task-priority"
              name="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriorityValue)}
              disabled={busy || !task}
              className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
            >
              {TASK_PRIORITY_VALUES.map((p) => (
                <option key={p} value={p}>
                  {taskPriorityLabel(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-task-column" className="text-zinc-300">
              Column
            </Label>
            <select
              id="edit-task-column"
              name="column"
              value={column}
              onChange={(e) => setColumn(e.target.value as TaskBoardColumnId)}
              disabled={busy || !task}
              className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
            >
              {TASK_BOARD_COLUMNS.map((c) => (
                <option key={c} value={c}>
                  {taskBoardColumnLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-task-progress" className="text-zinc-300">
              Progress
            </Label>
            <select
              id="edit-task-progress"
              name="progressPercent"
              value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
              disabled={busy || !task}
              className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
            >
              {TASK_PROGRESS_PERCENT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-task-description" className="text-zinc-300">
              Description (optional)
            </Label>
            <Textarea
              id="edit-task-description"
              name="description"
              maxLength={8000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary for the card…"
              disabled={busy || !task}
              className="min-h-[100px] resize-y rounded-md border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              className="text-zinc-400 hover:text-white"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !task || !title.trim()} className="min-w-[7rem] gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
