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

function compactCount(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(n);
}

/** e.g. $17.1k for values over $1k AUD. */
function compactAudFromMinor(minor: number): string {
  const dollars = minor / 100;
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }
  return formatCurrencyAmount(minor, DEFAULT_CURRENCY);
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

export function AdminHomeRightAside({ data }: { data: AdminPortalData }) {
  const proposals = [...data.proposals]
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, 5);

  const activities = [...data.proposals]
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card/80">
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

      <section className="rounded-xl border border-border bg-card/80">
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
  const accepted = data.proposals.filter((p) => p.status === "accepted").length;
  const proposalTotal = data.proposals.length;
  const acceptRate = proposalTotal === 0 ? 0 : (accepted / proposalTotal) * 100;
  const activeSubs = data.subscriptions.filter((s) => s.status === "active" || s.status === "trialing").length;

  const cardSalesMinor = Math.max(0, activeSubs) * 12_500 + proposalTotal * 2_100;
  const achReturnsMinor = Math.max(0, data.customers.length) * 1_800 + Math.max(0, proposalTotal - accepted) * 3_400;

  const { line, area } = buildChartPath();
  const rangeLabel = "Last 14 days";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Welcome back, {name}!
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Here are your stats for {today}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-sm text-muted-foreground hover:text-foreground" asChild>
          <Link href="#">
            <Settings2 className="h-4 w-4" aria-hidden />
            Customize dashboard
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Card sales"
          value={formatCurrencyAmount(cardSalesMinor, DEFAULT_CURRENCY)}
          delta="-15.5%"
          positive={false}
        />
        <MetricCard
          title="Card approval rate"
          value={`${acceptRate.toFixed(2)}%`}
          delta="+21.3%"
          positive
        />
        <MetricCard
          title="ACH returns"
          value={formatCurrencyAmount(achReturnsMinor, DEFAULT_CURRENCY)}
          delta="-9.7%"
          positive={false}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 border-y border-border py-5 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Gross volume</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
            {compactAudFromMinor(cardSalesMinor * 48)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">New customers</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
            {compactCount(data.customers.length)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">New accounts</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
            {compactCount(data.subscriptions.length)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Transactions</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
            {compactCount(Math.max(1, data.proposals.length + data.subscriptions.length))}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card/90 p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Volume trend</p>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-border bg-background/80 text-[13px] font-normal text-muted-foreground"
            type="button"
          >
            <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {rangeLabel}
          </Button>
        </div>
        <div className="relative -mx-1">
          <svg
            viewBox="0 0 600 132"
            className="h-auto w-full text-primary"
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
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <h2 className="text-base font-semibold text-foreground">Reports overview</h2>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 border-border bg-background/80 text-[13px] font-normal text-muted-foreground"
          type="button"
        >
          <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {rangeLabel}
        </Button>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  delta,
  positive,
}: {
  title: string;
  value: string;
  delta: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/90 p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      <p
        className={cn(
          "mt-2 inline-flex items-center gap-1 text-sm font-medium",
          positive ? "text-emerald-400" : "text-destructive",
        )}
      >
        {positive ? (
          <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {delta}
      </p>
    </div>
  );
}
