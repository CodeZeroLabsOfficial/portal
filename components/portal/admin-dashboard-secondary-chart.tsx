"use client";

import * as React from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AdminDashboardChartTabId,
  AdminDashboardChartTabPayload,
} from "@/lib/admin-dashboard-chart-payload";

function buildSvgPaths(
  points: number[],
  width: number,
  height: number,
): { line: string; area: string; dots: { x: number; y: number }[] } {
  const n = points.length;
  const baseline = height + 6;
  if (n === 0) {
    return { line: "", area: "", dots: [] };
  }
  const maxV = Math.max(...points, 1);
  const innerH = height - 10;
  const padTop = 6;
  const coords = points.map((v, i) => {
    const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
    const y = padTop + innerH - (v / maxV) * innerH;
    return { x, y };
  });
  const line = `M ${coords.map((p) => `${p.x},${p.y}`).join(" L ")}`;
  const area = `M 0,${baseline} L ${coords.map((p) => `${p.x},${p.y}`).join(" L ")} L ${width},${baseline} Z`;
  return { line, area, dots: coords };
}

interface AdminDashboardSecondaryChartProps {
  tabs: AdminDashboardChartTabPayload[];
  defaultTab?: AdminDashboardChartTabId;
  chartRangeLabel: string;
}

export function AdminDashboardSecondaryChart({
  tabs,
  defaultTab = "subscriptions",
  chartRangeLabel,
}: AdminDashboardSecondaryChartProps) {
  const [selected, setSelected] = React.useState<AdminDashboardChartTabId>(defaultTab);
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const gradientId = React.useId().replace(/:/g, "");

  const active = tabs.find((t) => t.id === selected) ?? tabs[0];
  const points = active?.points ?? [];
  const xLabels = active?.xLabels ?? [];
  const w = 600;
  const h = 120;
  const { line, area, dots } = buildSvgPaths(points, w, h);

  const maxV = Math.max(...points, 1);
  const hoverValue = hoverIdx !== null && points[hoverIdx] !== undefined ? points[hoverIdx] : null;
  const hoverLabel = hoverIdx !== null && xLabels[hoverIdx] !== undefined ? xLabels[hoverIdx] : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border/80">
      <div
        className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4"
        role="tablist"
        aria-label="Dashboard metrics"
      >
        {tabs.map((tab) => {
          const isSelected = tab.id === selected;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              title={tab.hint}
              aria-selected={isSelected}
              className={cn(
                "flex w-full flex-col items-center px-3 py-4 text-center transition-colors md:px-5",
                isSelected
                  ? "bg-primary/[0.06] text-primary"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
              )}
              onClick={() => {
                setSelected(tab.id);
                setHoverIdx(null);
              }}
            >
              <span
                className={cn(
                  "text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
                  isSelected ? "text-primary" : "text-muted-foreground",
                )}
              >
                {tab.valueDisplay}
              </span>
              <span
                className={cn(
                  "mt-1 text-xs font-medium",
                  isSelected ? "text-primary" : "text-foreground/80",
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative border-t border-border px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 rounded-md border-border bg-background/50 text-[13px] font-normal text-muted-foreground shadow-none"
            type="button"
          >
            <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {chartRangeLabel}
          </Button>
        </div>

        <div
          className="relative"
          onMouseLeave={() => setHoverIdx(null)}
          onMouseMove={(e) => {
            if (points.length === 0) {
              setHoverIdx(null);
              return;
            }
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * w;
            const idx =
              points.length === 1 ? 0 : Math.round((x / w) * (points.length - 1));
            const clamped = Math.max(0, Math.min(points.length - 1, idx));
            setHoverIdx(Number.isFinite(clamped) ? clamped : null);
          }}
        >
          {hoverIdx !== null && dots[hoverIdx] ? (
            <>
              <div
                className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-2 text-left text-xs shadow-md"
                style={{
                  left: `${(dots[hoverIdx].x / w) * 100}%`,
                  top: 8,
                  transform: "translateX(-50%)",
                }}
              >
                <p className="font-medium text-popover-foreground">{hoverLabel}</p>
                <p className="mt-0.5 tabular-nums text-muted-foreground">
                  {hoverValue} {hoverValue === 1 ? "update" : "updates"}
                </p>
              </div>
              <div
                className="pointer-events-none absolute top-0 border-l border-dotted border-primary/50"
                style={{
                  left: `${(dots[hoverIdx].x / w) * 100}%`,
                  height: "calc(100% - 28px)",
                  transform: "translateX(-50%)",
                }}
              />
            </>
          ) : null}

          <svg
            viewBox={`0 0 ${w} ${h + 16}`}
            className="h-auto w-full max-h-[260px] text-primary"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`${active?.label ?? "Metric"} trend`}
          >
            <title>{active?.label} trend</title>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.32} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            {points.length > 0
              ? Array.from({ length: points.length }, (_, i) => {
                  const gx = points.length === 1 ? w / 2 : (i / (points.length - 1)) * w;
                  return (
                    <line
                      key={i}
                      x1={gx}
                      y1={0}
                      x2={gx}
                      y2={h}
                      className="stroke-border"
                      strokeWidth={1}
                      strokeDasharray="4 6"
                    />
                  );
                })
              : null}
            {area ? <path d={area} fill={`url(#${gradientId})`} className="text-transparent" /> : null}
            {line ? (
              <path
                d={line}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </svg>
          <div className="mt-1 flex justify-between gap-1 text-[11px] text-muted-foreground">
            {xLabels.map((lab, i) => (
              <span key={i} className="min-w-0 flex-1 truncate text-center">
                {lab}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
