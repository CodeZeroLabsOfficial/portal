/** Integers 0–100 inclusive for task progress dropdowns. */
export const TASK_PROGRESS_PERCENT_OPTIONS: readonly number[] = Object.freeze(
  Array.from({ length: 101 }, (_, i) => i),
);

export function clampProgressPercent(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
