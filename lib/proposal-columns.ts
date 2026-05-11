/**
 * Columns block layout helpers — widths as CSS Grid `fr` tracks.
 */

export const PROPOSAL_COLUMN_FR_MIN = 0.12;
export const PROPOSAL_COLUMN_FR_MAX = 24;

export const PROPOSAL_COLUMNS_GRID_CLASS = "proposal-columns-grid";

/** Positive flex values ready for `--proposal-cols` → `Af Bf …`. */
export function coerceColumnFlex(columnCount: number, flex: number[] | undefined): number[] {
  if (!(columnCount >= 2 && columnCount <= 4)) {
    return Array.from({ length: Math.max(2, Math.min(columnCount, 4)) }, () => 1);
  }
  if (
    Array.isArray(flex) &&
    flex.length === columnCount &&
    flex.every(
      (x) =>
        typeof x === "number" &&
        Number.isFinite(x) &&
        x >= PROPOSAL_COLUMN_FR_MIN &&
        x <= PROPOSAL_COLUMN_FR_MAX,
    )
  ) {
    return flex.map((x) => clampFr(x));
  }
  return Array.from({ length: columnCount }, () => 1);
}

export function clampFr(x: number): number {
  if (!Number.isFinite(x)) return 1;
  return Math.min(PROPOSAL_COLUMN_FR_MAX, Math.max(PROPOSAL_COLUMN_FR_MIN, x));
}

/** CSS `grid-template-columns` value for `--proposal-cols` (fluid minmax tracks). */
export function columnFlexToGridTemplate(flex: number[]): string {
  return flex
    .map((f) => {
      const r = Math.round(clampFr(f) * 1000) / 1000;
      return `minmax(0,${r}fr)`;
    })
    .join(" ");
}

/** Drop `columnFlex` when it matches equal widths. */
export function normalizeColumnFlexForStorage(stacksLen: number, flex: number[] | undefined): number[] | undefined {
  const c = coerceColumnFlex(stacksLen, flex);
  if (c.every((x) => Math.abs(x - 1) < 1e-6)) return undefined;
  return c;
}

export function resizeColumnFlexWithStacks(
  prevFlex: number[] | undefined,
  prevCount: number,
  nextCount: number,
): number[] | undefined {
  if (prevCount === nextCount) return prevFlex;
  const base = coerceColumnFlex(prevCount, prevFlex);

  if (nextCount > prevCount) {
    const next = [...base];
    while (next.length < nextCount) {
      next.push(1);
    }
    return normalizeColumnFlexForStorage(next.length, next);
  }

  const head = base.slice(0, nextCount - 1);
  const tail = base.slice(nextCount - 1);
  const merged = tail.reduce((a, b) => a + b, 0);
  const next = [...head, clampFr(merged)];
  return normalizeColumnFlexForStorage(next.length, next);
}
