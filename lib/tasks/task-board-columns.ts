export const TASK_BOARD_COLUMNS = ["todo", "in_progress", "review", "done"] as const;

export type TaskBoardColumnId = (typeof TASK_BOARD_COLUMNS)[number];

export function taskBoardColumnLabel(id: TaskBoardColumnId): string {
  switch (id) {
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "review":
      return "In Review";
    case "done":
      return "Completed";
  }
}

export function isTaskBoardColumnId(value: string): value is TaskBoardColumnId {
  return (TASK_BOARD_COLUMNS as readonly string[]).includes(value);
}

/** Map stored `status` (and common legacy values) to a board column. */
export function statusToBoardColumn(raw: string | undefined): TaskBoardColumnId {
  const s = (raw ?? "open")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (s === "todo" || s === "open" || s === "to_do" || s === "backlog" || s === "new") {
    return "todo";
  }
  if (s === "in_progress" || s === "inprogress" || s === "doing" || s === "active" || s === "wip") {
    return "in_progress";
  }
  if (s === "review" || s === "in_review" || s === "qa") {
    return "review";
  }
  if (s === "done" || s === "completed" || s === "complete" || s === "closed" || s === "shipped") {
    return "done";
  }
  return "todo";
}

/** Canonical status string persisted to Firestore when moving cards. */
export function boardColumnToStatus(id: TaskBoardColumnId): string {
  return id;
}
