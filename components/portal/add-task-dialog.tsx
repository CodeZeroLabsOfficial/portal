"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createTaskAction, listTaskAssigneeOptionsAction } from "@/server/actions/tasks-crm";
import {
  TASK_BOARD_COLUMNS,
  taskBoardColumnLabel,
  type TaskBoardColumnId,
} from "@/lib/tasks/task-board-columns";
import {
  DEFAULT_TASK_PRIORITY,
  TASK_PRIORITY_VALUES,
  taskPriorityLabel,
  type TaskPriorityValue,
} from "@/lib/tasks/task-priority";
import { TASK_PROGRESS_PERCENT_OPTIONS } from "@/lib/tasks/task-progress-options";
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

export interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When the user opens from a column footer, that column is pre-selected. */
  defaultColumn: TaskBoardColumnId;
  disabled?: boolean;
  disabledReason?: string;
}

export function AddTaskDialog({
  open,
  onOpenChange,
  defaultColumn,
  disabled,
  disabledReason,
}: AddTaskDialogProps) {
  const router = useRouter();
  const [column, setColumn] = React.useState<TaskBoardColumnId>(defaultColumn);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<TaskPriorityValue>(DEFAULT_TASK_PRIORITY);
  const [progressPercent, setProgressPercent] = React.useState(0);
  const [assignedToUid, setAssignedToUid] = React.useState("");
  const [assigneeOptions, setAssigneeOptions] = React.useState<Array<{ uid: string; displayName: string; email: string }>>([]);
  const [loadingAssignees, setLoadingAssignees] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setColumn(defaultColumn);
    }
  }, [open, defaultColumn]);

  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setPriority(DEFAULT_TASK_PRIORITY);
      setProgressPercent(0);
      setAssignedToUid("");
      setServerError(null);
    }
  }, [open]);

  React.useEffect(() => {
    let cancelled = false;
    if (!open || disabled) return;
    setLoadingAssignees(true);
    void listTaskAssigneeOptionsAction().then((res) => {
      if (cancelled) return;
      setLoadingAssignees(false);
      if (!res.ok) {
        setServerError(res.message);
        setAssigneeOptions([]);
        return;
      }
      setAssigneeOptions(res.options);
      setAssignedToUid((current) => {
        if (current && res.options.some((o) => o.uid === current)) return current;
        return res.options[0]?.uid ?? "";
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, disabled]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setServerError(null);
    setPending(true);
    const res = await createTaskAction({
      title,
      description: description.trim() || undefined,
      column,
      priority,
      progressPercent,
      assignedToUid: assignedToUid || undefined,
    });
    setPending(false);
    if (!res.ok) {
      setServerError(res.message);
      return;
    }
    setTitle("");
    setDescription("");
    onOpenChange(false);
    router.refresh();
  }

  const busy = pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,800px)] w-[min(100vw-2rem,520px)] max-w-[520px] overflow-y-auto border-white/[0.08] bg-[#141414] p-0 sm:max-w-[520px]">
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">New task</DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 px-6 py-5" noValidate>
          <FormServerError message={serverError} rounded="xl" />

          {disabled ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {disabledReason ??
                "Tasks require an organization id on your user profile. Contact an administrator if this persists."}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title" className="text-zinc-300">
              Title
            </Label>
            <Input
              id="task-title"
              name="title"
              required
              maxLength={500}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design new landing page"
              autoComplete="off"
              disabled={busy || disabled}
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-priority" className="text-zinc-300">
              Priority
            </Label>
            <select
              id="task-priority"
              name="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriorityValue)}
              disabled={busy || disabled}
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
            <Label htmlFor="task-column" className="text-zinc-300">
              Column
            </Label>
            <select
              id="task-column"
              name="column"
              value={column}
              onChange={(e) => setColumn(e.target.value as TaskBoardColumnId)}
              disabled={busy || disabled}
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
            <Label htmlFor="task-progress" className="text-zinc-300">
              Progress
            </Label>
            <select
              id="task-progress"
              name="progressPercent"
              value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
              disabled={busy || disabled}
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
            <Label htmlFor="task-assignee" className="text-zinc-300">
              Assign to
            </Label>
            <select
              id="task-assignee"
              name="assignedToUid"
              value={assignedToUid}
              onChange={(e) => setAssignedToUid(e.target.value)}
              disabled={busy || disabled || loadingAssignees || assigneeOptions.length === 0}
              className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
            >
              {loadingAssignees ? <option value="">Loading users…</option> : null}
              {!loadingAssignees && assigneeOptions.length === 0 ? (
                <option value="">No assignable users</option>
              ) : null}
              {assigneeOptions.map((opt) => (
                <option key={opt.uid} value={opt.uid}>
                  {opt.displayName}
                  {opt.email ? ` (${opt.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description" className="text-zinc-300">
              Description (optional)
            </Label>
            <Textarea
              id="task-description"
              name="description"
              maxLength={8000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary for the card…"
              disabled={busy || disabled}
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
            <Button
              type="submit"
              disabled={busy || disabled || !title.trim() || (!loadingAssignees && assigneeOptions.length === 0)}
              className="min-w-[7rem] gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
