"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import type { SubscriptionRecord } from "@/types/subscription";
import { formatCurrencyAmount } from "@/lib/format";
import { AddSubscriptionModal } from "@/components/portal/add-subscription-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";

export interface SubscriptionListRow {
  subscription: SubscriptionRecord;
  /** Company-first label from CRM; not linked subscriptions show — */
  accountName: string;
  crmCustomerId?: string;
}

export interface SubscriptionListPanelProps {
  rows: SubscriptionListRow[];
  customerOptions: { id: string; label: string }[];
}

function formatTableDate(ms: number | undefined): string {
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

/** Best-effort monthly minor units for legacy rows before `monthlyAmountMinor` existed. */
function resolvedMonthlyMinor(s: SubscriptionRecord): number | undefined {
  const m = s.monthlyAmountMinor;
  if (typeof m === "number") return m;
  if (s.interval === "month" && typeof s.mrrAmount === "number") return s.mrrAmount;
  if (s.interval === "year" && typeof s.mrrAmount === "number") return Math.round(s.mrrAmount / 12);
  return undefined;
}

function collectionMethodDisplay(s: SubscriptionRecord): string {
  const cm = s.collectionMethod;
  const pmType = s.defaultPaymentMethodType;
  if (cm === "send_invoice") return "Manual invoice";

  const pmLabels: Record<string, string> = {
    card: "Credit card",
    sepa_debit: "SEPA Direct Debit",
    au_becs_debit: "BECS Direct Debit",
    us_bank_account: "ACH Direct Debit",
    bacs_debit: "Bacs Direct Debit",
    acss_debit: "Canadian PAD",
    paypal: "PayPal",
    link: "Link",
    klarna: "Klarna",
    afterpay_clearpay: "Afterpay",
  };

  if (pmType && pmLabels[pmType]) return pmLabels[pmType];
  if (pmType?.trim()) {
    return pmType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (cm === "charge_automatically") return "Automatic charge";
  return "—";
}

function statusBadge(status: SubscriptionRecord["status"]): { label: string; className: string } {
  if (status === "active" || status === "trialing") {
    return {
      label: status === "trialing" ? "Trialing" : "Active",
      className: "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    };
  }
  if (status === "past_due" || status === "unpaid") {
    return {
      label: status === "past_due" ? "Past due" : "Unpaid",
      className: "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300",
    };
  }
  if (status === "canceled") {
    return {
      label: "Canceled",
      className: "border-border bg-muted/50 text-muted-foreground",
    };
  }
  if (status === "paused") {
    return {
      label: "Paused",
      className: "border-border bg-muted/40 text-muted-foreground",
    };
  }
  return {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    className: "border-border bg-muted/40 text-muted-foreground",
  };
}

export function SubscriptionListPanel({ rows, customerOptions }: SubscriptionListPanelProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);

  React.useEffect(() => {
    router.refresh();
  }, [router]);

  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const s = r.subscription;
      const hay = [
        r.accountName,
        s.productName,
        s.priceId,
        s.status,
        collectionMethodDisplay(s),
        s.customerId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="space-y-8">
      <AddSubscriptionModal open={addOpen} onOpenChange={setAddOpen} customerOptions={customerOptions} />
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Subscriptions</h1>
          <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>Active Stripe subscriptions</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add subscription
        </Button>
      </motion.div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="shrink-0 text-sm font-semibold text-foreground">Directory</h2>
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search status, customer, product, Stripe id…"
              className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
              aria-label="Search subscriptions"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Customer (Account name)</th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Monthly amount</th>
                <th className="px-4 py-2.5 font-medium">Collection method</th>
                <th className="px-4 py-2.5 font-medium">Created date</th>
                <th className="px-4 py-2.5 font-medium">End date</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <p className="mx-auto max-w-md leading-relaxed">
                      No subscriptions yet. Stripe webhook events populate this directory after Checkout or Billing
                      changes.
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No subscriptions match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const s = row.subscription;
                  const st = statusBadge(s.status);
                  const monthlyMinor = resolvedMonthlyMinor(s);
                  const accountCell =
                    row.crmCustomerId && row.accountName !== "—" ? (
                      <Link
                        href={`/admin/customers/${row.crmCustomerId}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {row.accountName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{row.accountName}</span>
                    );

                  return (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 align-middle">
                        <Badge variant="outline" className={cn("font-normal capitalize", st.className)}>
                          {st.label}
                        </Badge>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 align-middle">{accountCell}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 align-middle text-muted-foreground">
                        {s.productName?.trim() || s.priceId || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-muted-foreground">
                        {typeof monthlyMinor === "number"
                          ? formatCurrencyAmount(monthlyMinor, s.currency)
                          : "—"}
                      </td>
                      <td className="max-w-[200px] px-4 py-3 align-middle text-muted-foreground">
                        {collectionMethodDisplay(s)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                        {formatTableDate(s.createdAtMs)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                        {formatTableDate(s.currentPeriodEndMs)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
