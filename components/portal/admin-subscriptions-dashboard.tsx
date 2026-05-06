import Link from "next/link";
import { AlertCircle, ArrowUpRight, Repeat, Settings, Users } from "lucide-react";
import type { AdminSubscriptionsSnapshot, StripeCustomerLink } from "@/server/firestore/crm-customers";
import type { SubscriptionRecord } from "@/types/subscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatShortDate(ms: number | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
  try {
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(ms));
  } catch {
    return "—";
  }
}

function shortStripeId(id: string): string {
  const t = id.trim();
  if (t.length <= 14) return t;
  return `${t.slice(0, 10)}…${t.slice(-4)}`;
}

function isActiveSubscription(s: SubscriptionRecord): boolean {
  return s.status === "active" || s.status === "trialing";
}

function subscriptionStatusBadge(status: SubscriptionRecord["status"]): {
  label: string;
  className: string;
} {
  if (status === "active" || status === "trialing") {
    return {
      label: status === "trialing" ? "Trialing" : "Active",
      className: "border-emerald-500/35 bg-emerald-500/12 text-emerald-100",
    };
  }
  if (status === "past_due" || status === "unpaid") {
    return {
      label: status === "past_due" ? "Past due" : "Unpaid",
      className: "border-amber-500/40 bg-amber-500/12 text-amber-100",
    };
  }
  if (status === "canceled") {
    return { label: "Canceled", className: "border-border bg-muted/50 text-muted-foreground" };
  }
  if (status === "paused") {
    return { label: "Paused", className: "border-border bg-muted/40 text-muted-foreground" };
  }
  return {
    label: status.replace(/_/g, " "),
    className: "border-border bg-muted/40 text-muted-foreground",
  };
}

function sortActiveSubscriptionsForDisplay(
  rows: SubscriptionRecord[],
  resolveCustomer: (stripeCustomerId: string) => StripeCustomerLink | undefined,
): SubscriptionRecord[] {
  const active = rows.filter(isActiveSubscription);
  return [...active].sort((a, b) => {
    const linkA = resolveCustomer(a.customerId);
    const linkB = resolveCustomer(b.customerId);
    const keyA = linkA ? linkA.label.toLowerCase() : `zzz-${a.customerId}`;
    const keyB = linkB ? linkB.label.toLowerCase() : `zzz-${b.customerId}`;
    if (keyA !== keyB) return keyA.localeCompare(keyB, undefined, { sensitivity: "base" });
    return (b.currentPeriodEndMs ?? 0) - (a.currentPeriodEndMs ?? 0);
  });
}

export interface AdminSubscriptionsDashboardProps {
  data: AdminSubscriptionsSnapshot | null;
  stripeApiConfigured: boolean;
  stripeWebhookConfigured: boolean;
}

export function AdminSubscriptionsDashboard({
  data,
  stripeApiConfigured,
  stripeWebhookConfigured,
}: AdminSubscriptionsDashboardProps) {
  const subs = data?.subscriptions ?? [];
  const links: Record<string, StripeCustomerLink> = data?.stripeCustomerLinks ?? {};

  function resolveCustomer(stripeCustomerId: string): StripeCustomerLink | undefined {
    return links[stripeCustomerId.trim()];
  }

  const displayed = sortActiveSubscriptionsForDisplay(subs, resolveCustomer);
  const unlinkedActiveCount = displayed.filter((s) => !resolveCustomer(s.customerId)).length;

  return (
    <div className="space-y-8">
      {!stripeApiConfigured ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Stripe API is not configured</p>
            <p className="mt-1 text-amber-100/85">
              Add your secret key under Settings → Integrations to sync subscriptions from Stripe into this list.
            </p>
            <Button variant="outline" size="sm" className="mt-3 border-amber-500/40 bg-transparent" asChild>
              <Link href="/admin/settings/integrations">
                <Settings className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Integrations
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {stripeApiConfigured && !stripeWebhookConfigured ? (
        <div className="flex gap-3 rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/90" aria-hidden />
          <div>
            <p className="font-medium text-foreground">Webhook signing secret missing</p>
            <p className="mt-1">
              This list is only as current as your last Stripe webhook delivery. Configure
              STRIPE_WEBHOOK_SECRET on the server for reliable subscription mirrors.
            </p>
          </div>
        </div>
      ) : null}

      {stripeApiConfigured && unlinkedActiveCount > 0 ? (
        <div className="flex gap-3 rounded-lg border border-sky-500/25 bg-sky-500/8 px-4 py-3 text-sm text-sky-100/95">
          <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium text-foreground">
              {unlinkedActiveCount === 1
                ? "1 subscription is not linked to a CRM customer"
                : `${unlinkedActiveCount} subscriptions are not linked to CRM customers`}
            </p>
            <p className="mt-1 text-muted-foreground">
              Open{" "}
              <Link href="/admin/customers" className="text-foreground underline underline-offset-4">
                Customers
              </Link>{" "}
              and set the Stripe Customer id (<code className="rounded bg-muted px-1 py-0.5 text-[11px]">cus_…</code>)
              on the right profile to turn the name into a link.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Repeat className="h-4 w-4" aria-hidden />
              Active &amp; trialing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{displayed.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Stripe status active or trialing</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Shortcuts</CardTitle>
            <CardDescription>CRM and Stripe workspace settings.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1 justify-between" asChild>
              <Link href="/admin/customers">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 opacity-70" aria-hidden />
                  Customers
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-50" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" className="flex-1 justify-between" asChild>
              <Link href="/admin/settings/integrations">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 opacity-70" aria-hidden />
                  Integrations
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-50" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Subscriptions</CardTitle>
          <CardDescription>
            {displayed.length === 0 ? (
              "No active or trialing subscriptions yet. Rows appear here after Stripe webhooks sync."
            ) : (
              <>
                {displayed.length} subscription{displayed.length === 1 ? "" : "s"} with Stripe status active or
                trialing. Rows link to Customers when the profile&apos;s Stripe Customer id (
                <code className="rounded bg-muted px-1 py-0.5 text-xs">cus_…</code>
                ) matches.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-2 pt-0 sm:px-0">
          {displayed.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              When a subscription is active or trialing in Stripe and mirrored by webhooks, it will appear in this
              list.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Interval</th>
                  <th className="px-4 py-3">Period end</th>
                  <th className="px-6 py-3 text-right">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((s) => {
                  const link = resolveCustomer(s.customerId);
                  const st = subscriptionStatusBadge(s.status);
                  return (
                    <tr key={s.id} className="border-b border-border/40 last:border-0">
                      <td className="px-6 py-3">
                        {link ? (
                          <Link
                            href={`/admin/customers/${link.customerId}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {link.label}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground" title={s.customerId}>
                            Not linked · {shortStripeId(s.customerId)}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                        {s.productName?.trim() || s.priceId || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn("font-normal", st.className)}>
                            {st.label}
                          </Badge>
                          {s.cancelAtPeriodEnd ? (
                            <Badge variant="outline" className="border-border text-[10px] font-normal">
                              Cancels end of period
                            </Badge>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{s.interval ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatShortDate(s.currentPeriodEndMs)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <code className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {shortStripeId(s.id)}
                        </code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
