import type { AdminPortalData } from "@/server/firestore/portal-data";

export type AdminDashboardChartTabId = "subscriptions" | "proposals" | "supportTickets" | "tasks";

export interface AdminDashboardChartTabPayload {
  id: AdminDashboardChartTabId;
  label: string;
  valueDisplay: string;
  hint?: string;
  points: number[];
  xLabels: string[];
}

function dayStartMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Last `count` calendar days ending on `now`'s date (local), oldest first. */
function buildDayStarts(now: Date, count: number): { starts: number[]; labels: string[] } {
  const end = dayStartMs(now);
  const starts: number[] = [];
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = end - i * 86400000;
    starts.push(t);
    labels.push(
      new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(t)),
    );
  }
  return { starts, labels };
}

/**
 * Buckets `timestamps` into the contiguous day windows defined by `dayStarts`
 * (oldest first). Each bucket spans `[dayStarts[i], dayStarts[i] + 86400000)`.
 * Single-pass O(N) by computing the bucket index directly from the timestamp
 * — equivalent to the previous nested-loop version, which only worked because
 * `dayStarts` is contiguous and sorted.
 */
function binTimestampsInDayBuckets(timestamps: number[], dayStarts: number[]): number[] {
  const counts = new Array(dayStarts.length).fill(0);
  if (dayStarts.length === 0) return counts;
  const first = dayStarts[0];
  const totalMs = dayStarts.length * 86400000;
  for (const ts of timestamps) {
    if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) continue;
    const offset = ts - first;
    if (offset < 0 || offset >= totalMs) continue;
    counts[Math.floor(offset / 86400000)] += 1;
  }
  return counts;
}

/**
 * Activity per day (last 14 days): subscriptions/proposals/tickets/tasks by `updatedAtMs`
 * (proposals also consider `createdAtMs` as activity signal).
 */
export function buildAdminDashboardChartTabs(
  data: AdminPortalData,
  now: Date,
  headlines: {
    subscriptions: string;
    proposals: string;
    supportTickets: string;
    tasks: string;
  },
  hints: Record<AdminDashboardChartTabId, string | undefined>,
): AdminDashboardChartTabPayload[] {
  const { starts, labels } = buildDayStarts(now, 14);

  const subPoints = binTimestampsInDayBuckets(
    data.subscriptions.map((s) => s.updatedAtMs),
    starts,
  );

  const proposalPoints = binTimestampsInDayBuckets(
    data.proposals.map((p) => Math.max(p.createdAtMs, p.updatedAtMs)),
    starts,
  );

  const ticketPoints = binTimestampsInDayBuckets(
    data.supportTickets.map((t) => t.updatedAtMs),
    starts,
  );

  const taskPoints = binTimestampsInDayBuckets(
    data.tasks.map((t) => t.updatedAtMs),
    starts,
  );

  return [
    {
      id: "subscriptions",
      label: "Subscriptions",
      valueDisplay: headlines.subscriptions,
      hint: hints.subscriptions,
      points: subPoints,
      xLabels: labels,
    },
    {
      id: "proposals",
      label: "Proposals",
      valueDisplay: headlines.proposals,
      hint: hints.proposals,
      points: proposalPoints,
      xLabels: labels,
    },
    {
      id: "supportTickets",
      label: "Support Tickets",
      valueDisplay: headlines.supportTickets,
      hint: hints.supportTickets,
      points: ticketPoints,
      xLabels: labels,
    },
    {
      id: "tasks",
      label: "Tasks",
      valueDisplay: headlines.tasks,
      hint: hints.tasks,
      points: taskPoints,
      xLabels: labels,
    },
  ];
}
