"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/server/actions/tasks-crm";
import {
  TASK_BOARD_COLUMNS,
  taskBoardColumnLabel,
  type TaskBoardColumnId,
} from "@/lib/tasks/task-board-columns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setColumn(defaultColumn);
    }
  }, [open, defaultColumn]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setPending(true);
    const res = await createTaskAction({
      title,
      description: description.trim() || undefined,
      column,
    });
    setPending(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    setTitle("");
    setDescription("");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 pt-2">
          {disabled ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              {disabledReason ??
                "Tasks require an organization id on your user profile. Contact an administrator if this persists."}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              name="title"
              required
              maxLength={500}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design new landing page"
              autoComplete="off"
              disabled={pending || disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-column">Column</Label>
            <select
              id="task-column"
              name="column"
              value={column}
              onChange={(e) => setColumn(e.target.value as TaskBoardColumnId)}
              disabled={pending || disabled}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                (pending || disabled) && "cursor-not-allowed opacity-50",
              )}
            >
              {TASK_BOARD_COLUMNS.map((c) => (
                <option key={c} value={c}>
                  {taskBoardColumnLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-description">Description (optional)</Label>
            <Textarea
              id="task-description"
              name="description"
              maxLength={8000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary for the card…"
              disabled={pending || disabled}
              className="resize-y"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || disabled || !title.trim()}>
              {pending ? "Saving…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
