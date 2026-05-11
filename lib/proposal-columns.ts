/**
 * Columns block layout helpers — widths as CSS Grid `fr` tracks.
 */

import type { ColumnsBlockGapPreset, ColumnsBlockRowAlign, ProposalColumnChildBlock } from "@/types/proposal";

/** Supported column counts for a Columns block (Firestore + editor). */
export type ColumnLayoutCount = 2 | 3 | 4;

/** Grow or shrink column stacks, merging overflow into the last kept column. */
export function resizeColumnStacks(
  stacks: ProposalColumnChildBlock[][],
  nextCount: ColumnLayoutCount,
): ProposalColumnChildBlock[][] {
  if (stacks.length === nextCount) return stacks;
  if (nextCount > stacks.length) {
    return [...stacks, ...Array.from({ length: nextCount - stacks.length }, () => [])];
  }
  const head = stacks.slice(0, nextCount);
  const tailMerged = stacks.slice(nextCount).flat();
  if (tailMerged.length === 0) return head;
  const next = head.map((s) => [...s]);
  next[nextCount - 1] = [...next[nextCount - 1], ...tailMerged];
  return next;
}

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

/**
 * Integer percentages (sum 100) from flex weights — for editor labels next to
 * column resize handles. Uses largest-remainder so totals stay exact.
 */
export function columnFlexPercents(weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) {
    const q = Math.floor(100 / n);
    const r = 100 - q * n;
    return weights.map((_, i) => q + (i < r ? 1 : 0));
  }
  const exact = weights.map((w) => (w / sum) * 100);
  const floors = exact.map((x) => Math.floor(x));
  const rem = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - floors[i] })).sort((a, b) => b.r - a.r);
  const out = [...floors];
  for (let k = 0; k < rem; k++) {
    out[order[k % order.length].i]++;
  }
  return out;
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

/** Horizontal gap between columns (`md:` and up). */
export function columnsBlockMdGapX(gap: ColumnsBlockGapPreset | undefined, colCount: number): string {
  const n = Math.min(4, Math.max(2, colCount)) as 2 | 3 | 4;
  const preset = gap ?? "normal";
  const table: Record<ColumnsBlockGapPreset, Record<2 | 3 | 4, string>> = {
    compact: { 2: "md:gap-x-4", 3: "md:gap-x-5", 4: "md:gap-x-6" },
    normal: { 2: "md:gap-x-10", 3: "md:gap-x-8", 4: "md:gap-x-6" },
    relaxed: { 2: "md:gap-x-14", 3: "md:gap-x-12", 4: "md:gap-x-10" },
  };
  return table[preset][n];
}

export function columnsBlockMdItemsClass(align: ColumnsBlockRowAlign | undefined): string {
  switch (align ?? "stretch") {
    case "start":
      return "md:items-start";
    case "center":
      return "md:items-center";
    case "end":
      return "md:items-end";
    default:
      return "md:items-stretch";
  }
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
