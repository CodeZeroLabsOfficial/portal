/** Values persisted on tasks and shown on Kanban cards. */
export const TASK_PRIORITY_VALUES = ["normal", "high", "premium"] as const;

export type TaskPriorityValue = (typeof TASK_PRIORITY_VALUES)[number];

export function taskPriorityLabel(value: TaskPriorityValue): string {
  switch (value) {
    case "normal":
      return "Normal";
    case "high":
      return "High";
    case "premium":
      return "Premium";
    default:
      return value;
  }
}

/** Normalizes arbitrary stored `priority` strings to the canonical picker values. */
export function coerceTaskPriority(raw: string | undefined): TaskPriorityValue {
  const s = (raw ?? "").trim().toLowerCase();
  if ((TASK_PRIORITY_VALUES as readonly string[]).includes(s)) {
    return s as TaskPriorityValue;
  }
  return "normal";
}
