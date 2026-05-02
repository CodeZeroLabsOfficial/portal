import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Check,
  ChevronRight,
  MoreHorizontal,
  Settings2,
} from "lucide-react";
import { APP_NAME, DEFAULT_CURRENCY } from "@/lib/constants";
import { formatCurrencyAmount } from "@/lib/format";
import type { InvoiceRecord } from "@/types/invoice";
import type { ProposalBlock, ProposalRecord } from "@/types/proposal";
import type { SupportTicketRecord } from "@/types/support-ticket";
import type { TaskRecord } from "@/types/task";
import type { PortalUser } from "@/types/user";
import type { SubscriptionRecord } from "@/types/subscription";
import type { AdminPortalData } from "@/server/firestore/portal-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function firstName(displayName: string, fallback: string): string {
  const name = displayName.trim();
  if (name) {
    return name.split(/\s+/)[0] ?? name;
  }
  const email = fallback.trim();
  if (email.includes("@")) {
    return email.split("@")[0] ?? "there";
  }
  return email || "there";
}

function formatWelcomeDate(d: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function shortRef(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  if (clean.length < 6) {
    return `#${id.slice(0, 8)}`;
  }
  return `#${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

/** Stable display amount for demo-style rows when Stripe totals are not on the row. */
function pseudoAmountMinorFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 48_000) + 2_400;
}

function proposalStatusLabel(status: string): { label: string; className: string } {
  if (status === "accepted") {
    return {
      label: "Succeeded",
      className:
        "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
    };
  }
  if (status === "sent" || status === "viewed") {
    return {
      label: "Pending",
      className: "border-amber-500/35 bg-amber-500/10 text-amber-100",
    };
  }
  return {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    className: "border-border bg-muted/40 text-muted-foreground",
  };
}

/** Demo curve — same shape as typical volume charts; stroke uses currentColor (primary). */
const CHART_POINTS = [
  { x: 0, y: 72 },
  { x: 100, y: 58 },
  { x: 200, y: 68 },
  { x: 300, y: 42 },
  { x: 400, y: 52 },
  { x: 500, y: 28 },
  { x: 600, y: 38 },
];

function buildChartPath(): { line: string; area: string } {
  const w = 600;
  const h = 120;
  const baseline = h + 8;
  const pts = CHART_POINTS.map((p) => `${p.x},${p.y}`).join(" L ");
  const line = `M ${pts}`;
  const area = `M 0,${baseline} L ${CHART_POINTS.map((p) => `${p.x},${p.y}`).join(" L ")} L ${w},${baseline} Z`;
  return { line, area };
}

function startOfMonthMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function startOfYearMs(d: Date): number {
  return new Date(d.getFullYear(), 0, 1).getTime();
}

function startOfPreviousMonthMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
}

function countActiveClients(customers: PortalUser[], subscriptions: SubscriptionRecord[]): number {
  const activeCustomerIds = new Set(
    subscriptions
      .filter((s) => s.status === "active" || s.status === "trialing")
      .map((s) => s.customerId)
      .filter(Boolean),
  );
  if (activeCustomerIds.size === 0) {
    return customers.length;
  }
  const matched = customers.filter(
    (c) =>
      (c.stripeCustomerId && activeCustomerIds.has(c.stripeCustomerId)) || activeCustomerIds.has(c.uid),
  ).length;
  return matched > 0 ? matched : customers.length;
}

/** Month-over-month % change in new customer sign-ups (calendar months). */
function newCustomersMomPercent(customers: PortalUser[], now: Date): { pct: number; neutral: boolean } {
  const thisMonthStart = startOfMonthMs(now);
  const lastMonthStart = startOfPreviousMonthMs(now);
  const newThisMonth = customers.filter((c) => c.createdAtMs >= thisMonthStart && c.createdAtMs <= now.getTime()).length;
  const newLastMonth = customers.filter(
    (c) => c.createdAtMs >= lastMonthStart && c.createdAtMs < thisMonthStart,
  ).length;
  if (newLastMonth === 0 && newThisMonth === 0) {
    return { pct: 0, neutral: true };
  }
  if (newLastMonth === 0) {
    return { pct: newThisMonth > 0 ? 100 : 0, neutral: newThisMonth === 0 };
  }
  const pct = ((newThisMonth - newLastMonth) / newLastMonth) * 100;
  return { pct, neutral: Math.abs(pct) < 0.05 };
}

type SubWithAmount = SubscriptionRecord & { mrrAmount?: number; amount?: number };

function sumMrrAndArr(subscriptions: SubscriptionRecord[]): { mrrMinor: number; arrMinor: number } {
  let mrrMinor = 0;
  let arrMinor = 0;
  for (const s of subscriptions) {
    if (s.status !== "active" && s.status !== "trialing") {
      continue;
    }
    const r = s as SubWithAmount;
    const minor = r.mrrAmount ?? r.amount ?? 0;
    if (minor <= 0) {
      continue;
    }
    if (s.interval === "year") {
      arrMinor += minor;
      mrrMinor += Math.round(minor / 12);
    } else {
      mrrMinor += minor;
      arrMinor += minor * 12;
    }
  }
  return { mrrMinor, arrMinor };
}

function paidInvoicesInRange(invoices: InvoiceRecord[], startMs: number, endMs: number): InvoiceRecord[] {
  return invoices.filter(
    (inv) =>
      inv.status === "paid" &&
      typeof inv.paidAtMs === "number" &&
      inv.paidAtMs >= startMs &&
      inv.paidAtMs <= endMs,
  );
}

function sumAmountDueMinor(invoices: InvoiceRecord[]): number {
  return invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
}

/** Paid invoice revenue: this month-to-date vs same number of days last month. */
const PRICING_MINOR_KEYS = [
  "totalMinorUnits",
  "amountMinorUnits",
  "subtotalMinorUnits",
  "totalCents",
  "amountCents",
  "amount",
] as const;

function extractPricingMinorFromBlock(block: ProposalBlock): number {
  if (block.type !== "pricing") {
    return 0;
  }
  const b = block as Record<string, unknown>;
  for (const k of PRICING_MINOR_KEYS) {
    const v = b[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      return Math.round(v);
    }
  }
  return 0;
}

function sumPendingProposalValueMinor(proposals: ProposalRecord[]): number {
  return proposals
    .filter((p) => p.status === "draft" || p.status === "sent" || p.status === "viewed")
    .reduce(
      (sum, p) =>
        sum + p.document.blocks.reduce((s, bl) => s + extractPricingMinorFromBlock(bl), 0),
      0,
    );
}

function isTaskOpenStatus(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s !== "done" &&
    s !== "completed" &&
    s !== "cancelled" &&
    s !== "canceled" &&
    s !== "closed"
  );
}

function isTicketOpenStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s !== "resolved" && s !== "closed" && s !== "done" && s !== "cancelled" && s !== "canceled";
}

function startOfCalendarWeekMs(d: Date): number {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = c.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  c.setDate(c.getDate() + toMonday);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

function endOfCalendarWeekMs(weekStartMs: number): number {
  return weekStartMs + 7 * 86400000 - 1;
}

function countTasksDueAndOverdue(tasks: TaskRecord[], now: Date): { dueThisWeek: number; overdue: number } {
  const nowMs = now.getTime();
  const wkStart = startOfCalendarWeekMs(now);
  const wkEnd = endOfCalendarWeekMs(wkStart);
  let dueThisWeek = 0;
  let overdue = 0;
  for (const t of tasks) {
    if (!isTaskOpenStatus(t.status)) {
      continue;
    }
    const due = t.dueAtMs;
    if (due === undefined || !Number.isFinite(due)) {
      continue;
    }
    if (due < nowMs) {
      overdue += 1;
    } else if (due >= wkStart && due <= wkEnd) {
      dueThisWeek += 1;
    }
  }
  return { dueThisWeek, overdue };
}

function countOpenTicketsByUrgency(tickets: SupportTicketRecord[]): {
  critical: number;
  high: number;
  medium: number;
} {
  const open = tickets.filter((t) => isTicketOpenStatus(t.status));
  let critical = 0;
  let high = 0;
  let medium = 0;
  for (const t of open) {
    if (t.urgency === "critical") {
      critical += 1;
    } else if (t.urgency === "high") {
      high += 1;
    } else {
      medium += 1;
    }
  }
  return { critical, high, medium };
}

function paidRevenueMomPercent(invoices: InvoiceRecord[], now: Date): { pct: number; neutral: boolean } {
  const thisMonthStart = startOfMonthMs(now);
  const nowMs = now.getTime();
  const lastMonthStart = startOfPreviousMonthMs(now);
  const dom = now.getDate();
  const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const cmpDom = Math.min(dom, daysInPrevMonth);
  const lastWindowEnd = new Date(now.getFullYear(), now.getMonth() - 1, cmpDom, 23, 59, 59, 999).getTime();
  const thisSlice = paidInvoicesInRange(invoices, thisMonthStart, nowMs);
  const lastSlice = paidInvoicesInRange(invoices, lastMonthStart, lastWindowEnd);
  const a = sumAmountDueMinor(thisSlice);
  const b = sumAmountDueMinor(lastSlice);
  if (a === 0 && b === 0) {
    return { pct: 0, neutral: true };
  }
  if (b === 0) {
    return { pct: a > 0 ? 100 : 0, neutral: a === 0 };
  }
  const pct = ((a - b) / b) * 100;
  return { pct, neutral: Math.abs(pct) < 0.05 };
}

export function AdminHomeRightAside({ data }: { data: AdminPortalData }) {
  const proposals = [...data.proposals]
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, 5);

  const activities = [...data.proposals]
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Recent transactions</h2>
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            See all
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[240px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Transaction ID</th>
                <th className="px-2 py-2.5 font-medium">Amount</th>
                <th className="px-2 py-2.5 font-medium">Status</th>
                <th className="w-10 px-2 py-2.5" aria-hidden />
              </tr>
            </thead>
            <tbody className="text-foreground">
              {proposals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No proposals yet
                  </td>
                </tr>
              ) : (
                proposals.map((p) => {
                  const st = proposalStatusLabel(p.status);
                  return (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">
                        {shortRef(p.id)}
                      </td>
                      <td className="px-2 py-3 tabular-nums text-foreground">
                        {formatCurrencyAmount(pseudoAmountMinorFromId(p.id), DEFAULT_CURRENCY)}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            st.className,
                          )}
                        >
                          {p.status === "accepted" ? (
                            <Check className="h-3 w-3 shrink-0" aria-hidden />
                          ) : null}
                          {st.label}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        <button
                          type="button"
                          className="inline-flex rounded-md p-1 hover:bg-muted"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Recent activities</h2>
          <Badge
            variant="outline"
            className="h-5 border-primary/50 bg-transparent px-2 text-[10px] font-semibold uppercase tracking-wide text-primary"
          >
            Beta
          </Badge>
        </div>
        <ul className="divide-y divide-border px-2 py-1">
          {activities.length === 0 ? (
            <li className="px-2 py-5 text-center text-sm text-muted-foreground">No recent activity</li>
          ) : (
            activities.map((p) => (
              <li key={p.id} className="flex gap-3 px-2 py-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/80" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                  <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                    Proposal · {p.status}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        {APP_NAME} — activity is mirrored from Firestore.
      </p>
    </div>
  );
}

export function AdminHomeDashboard({
  data,
  displayName,
  userLabel,
}: {
  data: AdminPortalData;
  displayName: string;
  userLabel: string;
}) {
  const name = firstName(displayName, userLabel);
  const today = formatWelcomeDate(new Date());
  const now = new Date();

  const activeClients = countActiveClients(data.customers, data.subscriptions);
  const clientsMom = newCustomersMomPercent(data.customers, now);
  const clientsDeltaStr = `${clientsMom.pct >= 0 ? "+" : ""}${clientsMom.pct.toFixed(1)}% vs last month`;

  const { mrrMinor, arrMinor } = sumMrrAndArr(data.subscriptions);
  const paidMom = paidRevenueMomPercent(data.invoices, now);
  const mrrGrowthStr = `${paidMom.pct >= 0 ? "+" : ""}${paidMom.pct.toFixed(1)}%`;

  const monthStart = startOfMonthMs(now);
  const nowMs = now.getTime();
  const yearStart = startOfYearMs(now);
  const paidThisMonth = paidInvoicesInRange(data.invoices, monthStart, nowMs);
  const revenueThisMonthMinor = sumAmountDueMinor(paidThisMonth);
  const paymentsThisMonth = paidThisMonth.length;

  const useYtdRevenue = revenueThisMonthMinor === 0 && paymentsThisMonth === 0;
  const paidYtd = paidInvoicesInRange(data.invoices, yearStart, nowMs);
  const revenueMinor = useYtdRevenue ? sumAmountDueMinor(paidYtd) : revenueThisMonthMinor;
  const paymentCount = useYtdRevenue ? paidYtd.length : paymentsThisMonth;
  const revenueTitle = useYtdRevenue
    ? `Total Revenue (${now.getFullYear()} YTD)`
    : "Total Revenue (this month)";

  const dom = now.getDate();
  const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const cmpDom = Math.min(dom, daysInPrevMonth);
  const lastMonthComparableEnd = new Date(now.getFullYear(), now.getMonth() - 1, cmpDom, 23, 59, 59, 999).getTime();
  const revenueLastMonthComparableMinor = sumAmountDueMinor(
    paidInvoicesInRange(data.invoices, startOfPreviousMonthMs(now), lastMonthComparableEnd),
  );

  let revenueDeltaStr: string | undefined;
  let revenueMomPct = 0;
  let revenueMomNeutral = true;
  if (!useYtdRevenue) {
    if (revenueLastMonthComparableMinor === 0) {
      revenueMomPct = revenueMinor > 0 ? 100 : 0;
      revenueMomNeutral = revenueMinor === 0;
    } else {
      revenueMomPct = ((revenueMinor - revenueLastMonthComparableMinor) / revenueLastMonthComparableMinor) * 100;
      revenueMomNeutral = Math.abs(revenueMomPct) < 0.05;
    }
    revenueDeltaStr = `${revenueMomPct >= 0 ? "+" : ""}${revenueMomPct.toFixed(1)}% vs last month`;
  }

  const totalSubs = data.subscriptions.length;
  const activeSubCount = data.subscriptions.filter(
    (s) => s.status === "active" || s.status === "trialing",
  ).length;
  const utilPct =
    data.customers.length === 0
      ? null
      : Math.min(100, Math.round((activeSubCount / data.customers.length) * 1000) / 10);
  const churnPct =
    totalSubs === 0 ? 0 : Math.round(((totalSubs - activeSubCount) / totalSubs) * 1000) / 10;

  const pendingProposals = data.proposals.filter(
    (p) => p.status === "draft" || p.status === "sent" || p.status === "viewed",
  );
  const pendingCount = pendingProposals.length;
  const pendingValueMinor = sumPendingProposalValueMinor(data.proposals);

  const ticketBuckets = countOpenTicketsByUrgency(data.supportTickets);
  const openTicketTotal =
    ticketBuckets.critical + ticketBuckets.high + ticketBuckets.medium;
  const taskDue = countTasksDueAndOverdue(data.tasks, now);
  const taskHeadlineTotal = taskDue.overdue + taskDue.dueThisWeek;

  const { line, area } = buildChartPath();
  const rangeLabel = "Last 14 days";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Welcome back, {name}!
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Here are your stats for {today}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="#">
            <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
            Customize dashboard
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-sm">
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <MetricCard
            variant="strip"
            title="Total Active Clients"
            value={String(activeClients)}
            delta={clientsDeltaStr}
            deltaCaption="Trend uses new customer sign-ups (full calendar months)"
            positive={clientsMom.pct > 0}
            neutralDelta={clientsMom.neutral}
          />
          <MetricCard
            variant="strip"
            title="MRR / ARR"
            titleDetail="Monthly / annual recurring revenue (active subscriptions)"
            value={formatCurrencyAmount(mrrMinor, DEFAULT_CURRENCY)}
            valueDetail={`ARR ${formatCurrencyAmount(arrMinor, DEFAULT_CURRENCY)}`}
            delta={mrrGrowthStr}
            deltaCaption="Growth from paid invoice volume (MTD vs same days prior month)"
            positive={paidMom.pct > 0}
            neutralDelta={paidMom.neutral}
          />
          <MetricCard
            variant="strip"
            title={revenueTitle}
            titleDetail="Paid invoices in organisation scope"
            value={formatCurrencyAmount(revenueMinor, DEFAULT_CURRENCY)}
            valueDetail={`${paymentCount} payments received`}
            delta={revenueDeltaStr}
            deltaCaption={
              useYtdRevenue ? undefined : "Compared with the same day-range last month"
            }
            positive={revenueDeltaStr !== undefined && revenueMomPct > 0}
            neutralDelta={revenueDeltaStr !== undefined ? revenueMomNeutral : revenueMinor === 0}
          />
        </div>

        <div className="grid grid-cols-2 divide-y divide-border border-t border-border md:grid-cols-4 md:divide-x md:divide-y-0">
          <SecondaryMetric
            value={String(activeSubCount)}
            valueClassName="text-primary"
            label="Active Subscriptions"
            detail={`${utilPct === null ? "—" : `${utilPct}%`} utilization · ${churnPct}% churn`}
          />
          <SecondaryMetric
            value={String(pendingCount)}
            label="Pending Proposals"
            detail={`${formatCurrencyAmount(pendingValueMinor, DEFAULT_CURRENCY)} total value`}
          />
          <SecondaryMetric
            value={String(openTicketTotal)}
            label="Open Support Tickets"
            detail={
              <span className="leading-relaxed">
                <span className="text-destructive/90">Critical {ticketBuckets.critical}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="text-amber-200/90">High {ticketBuckets.high}</span>
                <span className="text-muted-foreground"> · </span>
                <span>Medium {ticketBuckets.medium}</span>
              </span>
            }
          />
          <SecondaryMetric
            value={String(taskHeadlineTotal)}
            label="Tasks Due This Week"
            detail={
              taskDue.overdue === 0 && taskDue.dueThisWeek === 0
                ? "No open tasks with deadlines in range"
                : [
                    taskDue.overdue > 0 ? `${taskDue.overdue} overdue` : null,
                    taskDue.dueThisWeek > 0 ? `${taskDue.dueThisWeek} due remainder of week` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
        </div>

        <div className="border-t border-border px-5 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Volume trend</p>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 border-border bg-background/60 text-[13px] font-normal text-muted-foreground"
              type="button"
            >
              <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {rangeLabel}
            </Button>
          </div>
          <div className="relative -mx-0.5">
            <svg
              viewBox="0 0 600 132"
              className="h-auto w-full max-h-[200px] text-primary"
              role="img"
              aria-label="Volume trend chart"
            >
              <title>Volume trend</title>
              <defs>
                <linearGradient id="adminChartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              {[0, 100, 200, 300, 400, 500, 600].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={120}
                  className="stroke-border"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
              ))}
              <path d={area} fill="url(#adminChartFill)" className="text-transparent" />
              <path
                d={line}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-1 flex justify-between px-0.5 text-[11px] text-muted-foreground">
              <span>Day 1</span>
              <span>Day 4</span>
              <span>Day 8</span>
              <span>Day 12</span>
              <span>Day 14</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">Reports overview</h2>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-border bg-background/60 text-[13px] font-normal text-muted-foreground"
            type="button"
          >
            <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {rangeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SecondaryMetric({
  value,
  valueClassName,
  label,
  detail,
}: {
  value: string;
  valueClassName?: string;
  label: string;
  detail: ReactNode;
}) {
  return (
    <div className="flex flex-col px-5 py-4 sm:px-6">
      <p
        className={cn(
          "text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl",
          valueClassName,
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground/90">{detail}</p>
    </div>
  );
}

function MetricCard({
  variant = "default",
  title,
  titleDetail,
  value,
  valueDetail,
  delta,
  deltaCaption,
  positive,
  neutralDelta,
}: {
  variant?: "default" | "strip";
  title: string;
  titleDetail?: string;
  value: string;
  valueDetail?: string;
  delta?: string;
  deltaCaption?: string;
  positive: boolean;
  neutralDelta?: boolean;
}) {
  const showDelta = typeof delta === "string" && delta.length > 0;
  return (
    <div
      className={cn(
        variant === "strip"
          ? "bg-transparent px-5 py-5 sm:px-6"
          : "rounded-xl border border-border bg-card/90 p-5 shadow-sm",
      )}
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {titleDetail ? (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground/90">{titleDetail}</p>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {valueDetail ? (
        <p className="mt-1.5 text-sm font-medium tabular-nums text-muted-foreground">{valueDetail}</p>
      ) : null}
      {showDelta ? (
        <>
          <p
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-sm font-medium",
              neutralDelta ? "text-muted-foreground" : positive ? "text-emerald-400" : "text-destructive",
            )}
          >
            {neutralDelta ? null : positive ? (
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {delta}
          </p>
          {deltaCaption ? (
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{deltaCaption}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
