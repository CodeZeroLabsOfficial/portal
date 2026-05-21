import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  LineChart,
  Settings2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { formatCurrencyAmount } from "@/lib/format";
import {
  comparableLastMonthPaymentMinor,
  countActiveSubscriptions,
  countCrmContacts,
  crmContactsMomStats,
  paidInvoiceRevenueMomStats,
  succeededPaymentsMomStats,
  summarizeSucceededPayments,
  sumActiveSubscriptionMrrMinor,
} from "@/lib/admin-dashboard-metrics";
import { buildAdminDashboardChartTabs } from "@/lib/admin-dashboard-chart-payload";
import type { PaymentRecord } from "@/types/payment";
import type { ProposalBlock, ProposalRecord } from "@/types/proposal";
import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import type { SupportTicketRecord } from "@/types/support-ticket";
import type { TaskRecord } from "@/types/task";
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

function paymentStatusLabel(status: string): { label: string; className: string } {
  const s = status.toLowerCase();
  if (s === "succeeded") {
    return {
      label: "Succeeded",
      className: "bg-emerald-500/15 text-emerald-200",
    };
  }
  if (
    s === "processing" ||
    s === "requires_capture" ||
    s === "requires_action" ||
    s === "requires_confirmation" ||
    s === "requires_payment_method"
  ) {
    return {
      label: "Pending",
      className: "bg-amber-500/10 text-amber-100",
    };
  }
  if (s === "canceled" || s === "payment_failed") {
    return {
      label: s === "canceled" ? "Canceled" : "Failed",
      className: "bg-destructive/15 text-destructive",
    };
  }
  const label = s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    label,
    className: "bg-muted/40 text-muted-foreground",
  };
}

function stripePaymentDashboardUrl(payment: PaymentRecord): string {
  const id = payment.stripePaymentIntentId?.trim() || payment.id.trim();
  return `https://dashboard.stripe.com/payments/${encodeURIComponent(id)}`;
}

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
    .filter((p) => p.status === "draft" || p.status === "published" || p.status === "viewed")
    .reduce(
      (sum, p) =>
        sum +
        [...iterateProposalContentBlocks(p.document.blocks)].reduce(
          (s, bl) => s + extractPricingMinorFromBlock(bl),
          0,
        ),
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
    const due = t.dueAt;
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

export function AdminHomeRightAside({ data }: { data: AdminPortalData }) {
  const recentPayments = [...data.payments]
    .sort((a, b) => (b.createdAt || b.updatedAt) - (a.createdAt || a.updatedAt))
    .slice(0, 5);

  const activities = [...data.proposals]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border/80 bg-card/95 shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Recent transactions</h2>
          <a
            href="https://dashboard.stripe.com/payments"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            See all
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        <table className="w-full table-fixed text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="w-[40%] px-3 py-2.5 font-medium">Transaction ID</th>
              <th className="w-[30%] px-2 py-2.5 font-medium">Amount</th>
              <th className="w-[30%] px-2 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {recentPayments.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  No payments recorded yet
                </td>
              </tr>
            ) : (
              recentPayments.map((payment) => {
                const st = paymentStatusLabel(payment.status);
                const refId = payment.stripePaymentIntentId?.trim() || payment.id;
                return (
                  <tr key={payment.id} className="border-b border-border/60 last:border-0">
                    <td className="truncate px-3 py-3 font-mono text-[12px]">
                      <a
                        href={stripePaymentDashboardUrl(payment)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        title={refId}
                      >
                        {shortRef(refId)}
                      </a>
                    </td>
                    <td className="truncate px-2 py-3 tabular-nums text-foreground">
                      {formatCurrencyAmount(payment.amount, payment.currency || DEFAULT_CURRENCY)}
                    </td>
                    <td className="px-2 py-3">
                      <Badge variant="soft" className={cn("gap-1", st.className)}>
                        {payment.status === "succeeded" ? (
                          <Check className="h-3 w-3 shrink-0" aria-hidden />
                        ) : null}
                        {st.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-border/80 bg-card/95 shadow-sm">
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
            <li className="px-2 py-5 text-center text-[12px] font-normal leading-snug text-muted-foreground">
              No recent activity
            </li>
          ) : (
            activities.map((p) => (
              <li key={p.id} className="flex gap-3 px-2 py-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/80" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-normal leading-snug text-foreground">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-[10px] font-normal leading-snug capitalize text-muted-foreground">
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

  const nowMs = now.getTime();
  const contactCount = countCrmContacts(data.crmCustomers);
  const clientsMom = crmContactsMomStats(data.crmCustomers, now);
  const clientsDeltaStr = `${clientsMom.pct >= 0 ? "+" : ""}${clientsMom.pct.toFixed(1)}%`;

  const mrrMinor = sumActiveSubscriptionMrrMinor(data.subscriptions);
  const activeSubCount = countActiveSubscriptions(data.subscriptions);
  const paidMom = paidInvoiceRevenueMomStats(data.invoices, now);
  const mrrGrowthStr = `${paidMom.pct >= 0 ? "+" : ""}${paidMom.pct.toFixed(1)}%`;

  const paymentsSummary = summarizeSucceededPayments(data.payments, now);
  const paymentsMom = succeededPaymentsMomStats(data.payments, now);
  const paymentsLastMonthMinor = comparableLastMonthPaymentMinor(data.payments, now);
  const paymentsDeltaStr = paymentsSummary.useYtd
    ? undefined
    : `${paymentsMom.pct >= 0 ? "+" : ""}${paymentsMom.pct.toFixed(1)}%`;

  const totalSubs = data.subscriptions.length;
  const activeOrTrialCount = data.subscriptions.filter(
    (s) => s.status === "active" || s.status === "trialing",
  ).length;
  const utilPct =
    contactCount === 0
      ? null
      : Math.min(100, Math.round((activeSubCount / contactCount) * 1000) / 10);
  const churnPct =
    totalSubs === 0 ? 0 : Math.round(((totalSubs - activeOrTrialCount) / totalSubs) * 1000) / 10;

  const pendingProposals = data.proposals.filter(
    (p) => p.status === "draft" || p.status === "published" || p.status === "viewed",
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

  const clientsFooter = `Last month: ${clientsMom.lastMonthNew} new sign-up${clientsMom.lastMonthNew === 1 ? "" : "s"}`;

  const mrrFooter = `Last month: ${formatCurrencyAmount(paidMom.lastMinor, DEFAULT_CURRENCY)}`;

  const paymentsFooter = paymentsSummary.useYtd
    ? `${paymentsSummary.count} payments · ${paymentsSummary.year} YTD`
    : `Last month ${formatCurrencyAmount(paymentsLastMonthMinor, DEFAULT_CURRENCY)}`;

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
          metricLabel="With active subscriptions"
          value={String(contactCount)}
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
          value={formatCurrencyAmount(paymentsSummary.amountMinor, DEFAULT_CURRENCY)}
          footer={paymentsFooter}
          delta={paymentsDeltaStr}
          positive={paymentsDeltaStr !== undefined && paymentsMom.pct > 0}
          neutralDelta={
            paymentsDeltaStr !== undefined ? paymentsMom.neutral : paymentsSummary.amountMinor === 0
          }
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
    <div className="relative overflow-hidden rounded-[14px] border border-border/80 bg-card p-4 pb-5 shadow-sm">
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
