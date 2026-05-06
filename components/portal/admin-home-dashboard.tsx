import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  LineChart,
  MoreHorizontal,
  Settings2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { formatCurrencyAmount } from "@/lib/format";
import { buildAdminDashboardChartTabs } from "@/lib/admin-dashboard-chart-payload";
import type { InvoiceRecord } from "@/types/invoice";
import type { ProposalBlock, ProposalRecord } from "@/types/proposal";
import type { SupportTicketRecord } from "@/types/support-ticket";
import type { TaskRecord } from "@/types/task";
import type { PortalUser } from "@/types/user";
import type { SubscriptionRecord } from "@/types/subscription";
import type { AdminPortalData } from "@/server/firestore/portal-data";
import { AdminDashboardSecondaryChart } from "@/components/portal/admin-dashboard-secondary-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";
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
    return 0;
  }
  const matched = customers.filter(
    (c) =>
      (c.stripeCustomerId && activeCustomerIds.has(c.stripeCustomerId)) || activeCustomerIds.has(c.uid),
  ).length;
  return matched;
}

/** Month-over-month % change in new customer sign-ups (calendar months). */
function newCustomersMomStats(customers: PortalUser[], now: Date): {
  pct: number;
  neutral: boolean;
  lastMonthNew: number;
} {
  const thisMonthStart = startOfMonthMs(now);
  const lastMonthStart = startOfPreviousMonthMs(now);
  const nowMs = now.getTime();
  const newThisMonth = customers.filter(
    (c) => c.createdAtMs >= thisMonthStart && c.createdAtMs <= nowMs,
  ).length;
  const newLastMonth = customers.filter(
    (c) => c.createdAtMs >= lastMonthStart && c.createdAtMs < thisMonthStart,
  ).length;
  if (newLastMonth === 0 && newThisMonth === 0) {
    return { pct: 0, neutral: true, lastMonthNew: 0 };
  }
  if (newLastMonth === 0) {
    return {
      pct: newThisMonth > 0 ? 100 : 0,
      neutral: newThisMonth === 0,
      lastMonthNew: 0,
    };
  }
  const pct = ((newThisMonth - newLastMonth) / newLastMonth) * 100;
  return { pct, neutral: Math.abs(pct) < 0.05, lastMonthNew: newLastMonth };
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
  if (block.type === "packages") {
    let maxVal = 0;
    for (const t of block.tiers) {
      const v12 = t.monthlyCost12Minor * 12 + (t.upfrontCost12Minor ?? 0);
      const v24 = t.monthlyCost24Minor * 24;
      maxVal = Math.max(maxVal, v12, v24);
    }
    return maxVal > 0 ? Math.round(maxVal) : 0;
  }
  if (block.type !== "pricing") {
    return 0;
  }
  if (block.lineItems.length > 0) {
    let sum = 0;
    for (const li of block.lineItems) {
      const unit = typeof li.unitAmountMinor === "number" ? li.unitAmountMinor : 0;
      const qty = typeof li.quantity === "number" && li.quantity > 0 ? li.quantity : 1;
      sum += Math.round(unit * qty);
    }
    if (sum > 0) return sum;
  }
  const b = block as unknown as Record<string, unknown>;
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

function paidRevenueMomStats(invoices: InvoiceRecord[], now: Date): {
  pct: number;
  neutral: boolean;
  lastMinor: number;
} {
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
    return { pct: 0, neutral: true, lastMinor: 0 };
  }
  if (b === 0) {
    return { pct: a > 0 ? 100 : 0, neutral: a === 0, lastMinor: 0 };
  }
  const pct = ((a - b) / b) * 100;
  return { pct, neutral: Math.abs(pct) < 0.05, lastMinor: b };
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
  const clientsMom = newCustomersMomStats(data.customers, now);
  const clientsDeltaStr = `${clientsMom.pct >= 0 ? "+" : ""}${clientsMom.pct.toFixed(1)}%`;

  const { mrrMinor } = sumMrrAndArr(data.subscriptions);
  const paidMom = paidRevenueMomStats(data.invoices, now);
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

  const chartTabs = buildAdminDashboardChartTabs(
    data,
    now,
    {
      subscriptions: String(activeSubCount),
      proposals: String(pendingCount),
      supportTickets: String(openTicketTotal),
      tasks: String(taskHeadlineTotal),
    },
    {
      subscriptions: `${utilPct === null ? "—" : `${utilPct}%`} utilization · ${churnPct}% churn (non-active share)`,
      proposals: `Pending pipeline · ${formatCurrencyAmount(pendingValueMinor, DEFAULT_CURRENCY)} total value`,
      supportTickets: `Critical ${ticketBuckets.critical} · High ${ticketBuckets.high} · Medium ${ticketBuckets.medium}`,
      tasks:
        taskDue.overdue === 0 && taskDue.dueThisWeek === 0
          ? "No open tasks with due dates in range"
          : [
              taskDue.overdue > 0 ? `${taskDue.overdue} overdue` : null,
              taskDue.dueThisWeek > 0 ? `${taskDue.dueThisWeek} due remainder of week` : null,
            ]
              .filter(Boolean)
              .join(" · "),
    },
  );

  const chartRangeEnd = new Date(nowMs);
  const chartRangeStart = new Date(nowMs);
  chartRangeStart.setDate(chartRangeStart.getDate() - 13);
  const chartRangeLabel = `${formatShortChartDate(chartRangeStart)} - ${formatShortChartDate(chartRangeEnd)}`;

  const revenueValueDetail = useYtdRevenue
    ? `${paymentCount} payments · ${now.getFullYear()} YTD`
    : `${paymentCount} payments received`;

  const clientsFooter = `Last month: ${clientsMom.lastMonthNew} new sign-up${clientsMom.lastMonthNew === 1 ? "" : "s"}`;

  const mrrFooter = `Last month: ${formatCurrencyAmount(paidMom.lastMinor, DEFAULT_CURRENCY)}`;

  const revenueFooter = `${revenueValueDetail} · Last month ${formatCurrencyAmount(revenueLastMonthComparableMinor, DEFAULT_CURRENCY)}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Welcome back, {name}!</h1>
          <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>Here are your stats for {today}</p>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          heading="Customers"
          metricLabel="Total active customers"
          value={String(activeClients)}
          footer={clientsFooter}
          delta={clientsDeltaStr}
          positive={clientsMom.pct > 0}
          neutralDelta={clientsMom.neutral}
          icon={Users}
        />
        <MetricCard
          heading="Revenue"
          metricLabel="MRR"
          value={formatCurrencyAmount(mrrMinor, DEFAULT_CURRENCY)}
          footer={mrrFooter}
          delta={mrrGrowthStr}
          positive={paidMom.pct > 0}
          neutralDelta={paidMom.neutral}
          icon={LineChart}
        />
        <MetricCard
          heading="Payments"
          metricLabel="Total revenue"
          value={formatCurrencyAmount(revenueMinor, DEFAULT_CURRENCY)}
          footer={revenueFooter}
          delta={revenueDeltaStr?.replace(/\s+vs last month$/i, "")}
          positive={revenueDeltaStr !== undefined && revenueMomPct > 0}
          neutralDelta={revenueDeltaStr !== undefined ? revenueMomNeutral : revenueMinor === 0}
          icon={Wallet}
        />
      </div>

      <div className="border-t border-border/70 pt-8">
        <AdminDashboardSecondaryChart tabs={chartTabs} chartRangeLabel={chartRangeLabel} />
      </div>
    </div>
  );
}

function formatShortChartDate(d: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

type MetricCardProps = {
  heading: string;
  metricLabel: string;
  value: string;
  footer?: string;
  delta?: string;
  positive: boolean;
  neutralDelta?: boolean;
  icon: LucideIcon;
};

function MetricCard({
  heading,
  metricLabel,
  value,
  footer,
  delta,
  positive,
  neutralDelta,
  icon: Icon,
}: MetricCardProps) {
  const showDelta = typeof delta === "string" && delta.length > 0;
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-border/80 bg-card pb-5 pl-3 pr-5 pt-3 shadow-sm">
      <div
        className="pointer-events-none absolute -bottom-10 -right-8 h-36 w-36 rounded-full bg-primary/[0.07]"
        aria-hidden
      />
      <div className="relative">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="truncate text-[14px] font-semibold leading-tight text-foreground">{heading}</span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-normal leading-snug text-muted-foreground">{metricLabel}</p>
            <p className="mt-1.5 text-[26px] font-bold leading-none tracking-tight text-foreground tabular-nums">
              {value}
            </p>
          </div>
          {showDelta ? (
            <div
              className={cn(
                "max-w-[42%] shrink-0 text-right text-[11px] font-medium leading-tight tabular-nums",
                neutralDelta
                  ? "text-muted-foreground"
                  : positive
                    ? "text-emerald-400"
                    : "text-destructive",
              )}
            >
              <span className="inline-flex items-center justify-end gap-0.5">
                <span className="break-words">{delta}</span>
                {neutralDelta ? null : positive ? (
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
              </span>
            </div>
          ) : null}
        </div>

        {footer ? (
          <p className="mt-4 text-[10px] font-normal leading-snug text-muted-foreground">{footer}</p>
        ) : null}
      </div>
    </div>
  );
}
