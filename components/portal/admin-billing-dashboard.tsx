import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CreditCard,
  ExternalLink,
  FileText,
  Link2,
  Settings,
  Users,
} from "lucide-react";
import type { AdminBillingSnapshot, StripeCustomerLink } from "@/server/firestore/crm-customers";
import { formatCurrencyAmount } from "@/lib/format";
import type { InvoiceRecord } from "@/types/invoice";
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

function invoiceStatusBadge(status: InvoiceRecord["status"]): { label: string; className: string } {
  if (status === "paid") {
    return { label: "Paid", className: "border-emerald-500/35 bg-emerald-500/12 text-emerald-100" };
  }
  if (status === "open") {
    return { label: "Open", className: "border-sky-500/35 bg-sky-500/10 text-sky-100" };
  }
  if (status === "draft") {
    return { label: "Draft", className: "border-border bg-muted/40 text-muted-foreground" };
  }
  return {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    className: "border-border bg-muted/40 text-muted-foreground",
  };
}

function billingMetrics(subs: SubscriptionRecord[], invoices: InvoiceRecord[]) {
  const healthy = subs.filter((s) => s.status === "active" || s.status === "trialing").length;
  const atRisk = subs.filter(
    (s) => s.status === "past_due" || s.status === "unpaid" || s.status === "incomplete",
  ).length;
  const openInvoices = invoices.filter((i) => i.status === "open");
  const currencies = new Set(openInvoices.map((i) => i.currency.toLowerCase()));
  const singleCurrency = currencies.size === 1 ? openInvoices[0]?.currency ?? "aud" : null;
  const openBalance =
    singleCurrency !== null
      ? openInvoices.reduce((acc, i) => acc + (i.amountDue ?? 0), 0)
      : 0;
  return { healthy, atRisk, openInvoiceCount: openInvoices.length, openBalance, singleCurrency };
}

export interface AdminBillingDashboardProps {
  data: AdminBillingSnapshot | null;
  stripeApiConfigured: boolean;
  stripeWebhookConfigured: boolean;
}

export function AdminBillingDashboard({
  data,
  stripeApiConfigured,
  stripeWebhookConfigured,
}: AdminBillingDashboardProps) {
  const subs = data?.subscriptions ?? [];
  const invoices = data?.invoices ?? [];
  const links: Record<string, StripeCustomerLink> = data?.stripeCustomerLinks ?? {};
  const metrics = billingMetrics(subs, invoices);

  function resolveCustomer(stripeCustomerId: string): StripeCustomerLink | undefined {
    return links[stripeCustomerId.trim()];
  }

  return (
    <div className="space-y-8">
      {!stripeApiConfigured ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Stripe API is not configured</p>
            <p className="mt-1 text-amber-100/85">
              Add your secret key under Settings → Integrations to enable Checkout, invoices, and
              Customer Portal links for staff workflows.
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
              Subscription and invoice rows below only update when Stripe webhooks are verified.
              Configure STRIPE_WEBHOOK_SECRET alongside your endpoint for trustworthy mirrors.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="h-4 w-4" aria-hidden />
              Healthy subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{metrics.healthy}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active or trialing</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-amber-400/90" aria-hidden />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{metrics.atRisk}</p>
            <p className="mt-1 text-xs text-muted-foreground">Past due, unpaid, or incomplete</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" aria-hidden />
              Open invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{metrics.openInvoiceCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {metrics.openInvoiceCount === 0
                ? "Nothing outstanding"
                : metrics.singleCurrency && metrics.openBalance > 0
                  ? `${formatCurrencyAmount(metrics.openBalance, metrics.singleCurrency)} outstanding`
                  : "Mixed currencies — see table"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden />
              Tracked subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{subs.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Rows synced from Stripe</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 bg-card/90 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Workflows</CardTitle>
            <CardDescription>Jump into CRM or workspace configuration.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="outline" className="justify-between" asChild>
              <Link href="/admin/customers">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 opacity-70" aria-hidden />
                  Customers
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-50" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between" asChild>
              <Link href="/admin/settings/integrations">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 opacity-70" aria-hidden />
                  Stripe integrations
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-50" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between" asChild>
              <Link href="/admin/proposals">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 opacity-70" aria-hidden />
                  Proposals & Checkout
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-50" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Linking Stripe to CRM</CardTitle>
            <CardDescription>
              Each CRM contact can store a Stripe Customer id. Subscriptions and invoices below match on
              that id — paste <code className="rounded bg-muted px-1 py-0.5 text-xs">cus_…</code> on the
              customer profile or use proposal Checkout to create it automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3 text-sm text-muted-foreground">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden />
            <p>
              For subscription management in Stripe&apos;s UI (payment methods, invoices, cancellation
              rules), use{" "}
              <Link className="text-foreground underline underline-offset-4" href="/admin/customers">
                customer profiles
              </Link>{" "}
              → Billing section, or open the Stripe Dashboard when you need raw API objects.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Subscriptions</CardTitle>
          <CardDescription>
            Mirrored subscription rows ({subs.length}). Manage payment methods and mandates in Stripe or
            via the customer&apos;s portal session from their CRM profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-2 pt-0 sm:px-0">
          {subs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No subscription rows yet. Webhooks populate this list after the first Checkout or
              subscription event.
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
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
                {subs.map((s) => {
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
                            Unlinked · {shortStripeId(s.customerId)}
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

      <Card className="border-border/70 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
          <CardDescription>
            Recent mirrored invoices ({invoices.length}). Open the hosted invoice when you need to
            collect payment or share a PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-2 pt-0 sm:px-0">
          {invoices.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No invoice rows yet. Finalized Stripe invoices appear here after webhook processing.
            </p>
          ) : (
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Amount due</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-6 py-3 text-right">Links</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const link = resolveCustomer(inv.customerId);
                  const ib = invoiceStatusBadge(inv.status);
                  return (
                    <tr key={inv.id} className="border-b border-border/40 last:border-0">
                      <td className="px-6 py-3">
                        {link ? (
                          <Link
                            href={`/admin/customers/${link.customerId}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {link.label}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground" title={inv.customerId}>
                            Unlinked · {shortStripeId(inv.customerId)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("font-normal", ib.className)}>
                          {ib.label}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {formatCurrencyAmount(inv.amountDue, inv.currency)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatShortDate(inv.issuedAtMs)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatShortDate(inv.paidAtMs)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {inv.hostedInvoiceUrl ? (
                            <a
                              href={inv.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                            >
                              Hosted
                              <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {inv.invoicePdf ? (
                            <a
                              href={inv.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                            >
                              PDF
                              <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                            </a>
                          ) : null}
                        </div>
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
