/** 0–100 in 5% steps for task progress dropdowns. */
export const TASK_PROGRESS_PERCENT_OPTIONS: readonly number[] = Object.freeze(
  Array.from({ length: 21 }, (_, i) => i * 5),
);

/** Clamps to 0–100 and snaps to the nearest 5% so values match dropdown options. */
export function clampProgressPercent(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  return Math.round(clamped / 5) * 5;
}
