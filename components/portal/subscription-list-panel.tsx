"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Filter, ListChecks, Loader2, MoreHorizontal, Plus, Search } from "lucide-react";
import type { SubscriptionRecord, SubscriptionStatus } from "@/types/subscription";
import {
  getSubscriptionPausedBadgeDisplay,
  getSubscriptionStatusBadgeDisplay,
} from "@/lib/subscription-status-badge";
import { formatCurrencyAmount } from "@/lib/format";
import { AddSubscriptionModal } from "@/components/portal/add-subscription-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import {
  cancelSubscriptionAction,
  deleteSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
} from "@/server/actions/subscriptions-crm";

export interface SubscriptionListRow {
  subscription: SubscriptionRecord;
  /** Company-first label from CRM; not linked subscriptions show — */
  accountName: string;
  crmCustomerId?: string;
}

export interface SubscriptionListPanelProps {
  rows: SubscriptionListRow[];
  customerOptions: { id: string; label: string }[];
  catalogServiceOptions: CatalogServicePickerOption[];
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

function subscriptionStatusDisplay(s: SubscriptionRecord): { label: string; className: string } {
  if (s.paymentCollectionPaused && s.status !== "canceled" && s.status !== "scheduled") {
    return getSubscriptionPausedBadgeDisplay();
  }
  return getSubscriptionStatusBadgeDisplay(s.status);
}

function canPauseSubscription(s: SubscriptionRecord): boolean {
  if (s.paymentCollectionPaused || s.id.startsWith("sub_sched_")) return false;
  if (s.status === "scheduled" || s.status === "canceled" || s.status === "paused") return false;
  return (
    s.status === "active" ||
    s.status === "trialing" ||
    s.status === "past_due" ||
    s.status === "unpaid"
  );
}

function canResumeSubscription(s: SubscriptionRecord): boolean {
  return Boolean(s.paymentCollectionPaused);
}

type SubscriptionStatusFilter =
  | "all"
  | "active"
  | "trialing"
  | "scheduled"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "paused";

type SubscriptionProductFilter = "all" | string;

function subscriptionFilterStatus(s: SubscriptionRecord): Exclude<SubscriptionStatusFilter, "all"> | null {
  if (s.paymentCollectionPaused && s.status !== "canceled" && s.status !== "scheduled") {
    return "paused";
  }
  if (
    s.status === "active" ||
    s.status === "trialing" ||
    s.status === "scheduled" ||
    s.status === "past_due" ||
    s.status === "unpaid" ||
    s.status === "canceled" ||
    s.status === "paused"
  ) {
    return s.status;
  }
  return null;
}

function matchesStatusFilter(s: SubscriptionRecord, statusFilter: SubscriptionStatusFilter): boolean {
  if (statusFilter === "all") return true;
  return subscriptionFilterStatus(s) === statusFilter;
}

function matchesProductFilter(s: SubscriptionRecord, productFilter: SubscriptionProductFilter): boolean {
  if (productFilter === "all") return true;
  const name = s.productName?.trim();
  if (!name) return false;
  return name === productFilter;
}

export function SubscriptionListPanel({ rows, customerOptions, catalogServiceOptions }: SubscriptionListPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [addOpen, setAddOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<SubscriptionStatusFilter>("all");
  const [productFilter, setProductFilter] = React.useState<SubscriptionProductFilter>("all");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  React.useEffect(() => {
    router.refresh();
  }, [router]);

  React.useEffect(() => {
    if (searchParams.get("addSubscription") !== "1") return;
    setAddOpen(true);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("addSubscription");
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const productOptions = React.useMemo(() => {
    const names = new Set<string>();
    for (const row of rows) {
      const name = row.subscription.productName?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const s = r.subscription;
      if (!matchesStatusFilter(s, statusFilter)) return false;
      if (!matchesProductFilter(s, productFilter)) return false;
      if (!q) return true;
      const hay = [
        r.accountName,
        s.productName,
        s.priceId,
        s.status,
        subscriptionStatusDisplay(s).label,
        collectionMethodDisplay(s),
        s.customerId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, statusFilter, productFilter]);

  const filteredIds = React.useMemo(() => filtered.map((r) => r.subscription.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected = filteredIds.some((id) => selected.has(id));
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} selected subscription${ids.length === 1 ? "" : "s"} now? This immediately cancels them in Stripe.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    const failed: string[] = [];
    for (const id of ids) {
      const res = await deleteSubscriptionAction(id);
      if (!res.ok) failed.push(id);
    }
    setBulkBusy(false);
    if (failed.length > 0) {
      window.alert(`Deleted ${ids.length - failed.length} of ${ids.length}. ${failed.length} failed.`);
    } else {
      setSelected(new Set());
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <AddSubscriptionModal
        open={addOpen}
        onOpenChange={setAddOpen}
        customerOptions={customerOptions}
        catalogServiceOptions={catalogServiceOptions}
      />
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
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs md:max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search status, customer, product, collection method..."
                className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
                aria-label="Search subscriptions"
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="relative">
                <Filter
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as SubscriptionStatusFilter)}
                  className={cn(
                    "h-9 appearance-none rounded-full border border-border/80 bg-background/60 py-0 pl-8 pr-8 text-[13px] font-medium text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="paused">Paused</option>
                  <option value="past_due">Past due</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="canceled">Canceled</option>
                </select>
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className={cn(
                    "h-9 appearance-none rounded-full border border-border/80 bg-background/60 py-0 sm:pl-3 pr-8 text-[13px] font-medium text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    productOptions.length === 0 ? "max-w-[10rem]" : "max-w-[14rem]",
                  )}
                  aria-label="Filter by product"
                >
                  <option value="all">All products</option>
                  {productOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 border-border/80 bg-card/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    aria-label="Bulk actions"
                    title={selected.size > 0 ? `${selected.size} selected` : "Bulk actions"}
                    disabled={bulkBusy}
                  >
                    <ListChecks className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[11rem] border-border/80 bg-popover text-popover-foreground shadow-lg"
                >
                  <DropdownMenuItem
                    disabled={selected.size === 0 || bulkBusy}
                    className="text-destructive focus:text-destructive"
                    onClick={() => void handleBulkDelete()}
                  >
                    Delete selected ({selected.size})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-[13px]">
            <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="w-12 px-4 py-2.5">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                  aria-label="Select all visible subscriptions"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Account name</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Monthly amount</th>
                <th className="px-4 py-2.5 font-medium">Collection method</th>
                <th className="px-4 py-2.5 font-medium">Created date</th>
                <th className="px-4 py-2.5 font-medium">End date</th>
                <th className="w-14 px-2 py-2.5 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <p className="mx-auto max-w-md leading-relaxed">No subscriptions yet.</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No subscriptions match your filters.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {filtered.map((row, index) => {
                  const s = row.subscription;
                  const st = subscriptionStatusDisplay(s);
                  const monthlyMinor = resolvedMonthlyMinor(s);
                  const pauseAllowed = canPauseSubscription(s);
                  const resumeAllowed = canResumeSubscription(s);
                  const rowBusy = pendingId === s.id || bulkBusy;
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

                  async function handlePause() {
                    if (
                      !window.confirm(
                        "Pause payment collection for this subscription? Invoices during the pause will be voided and no charges will be collected until you resume.",
                      )
                    ) {
                      return;
                    }
                    setPendingId(s.id);
                    const res = await pauseSubscriptionAction(s.id);
                    setPendingId(null);
                    if (!res.ok) {
                      window.alert(res.message);
                      return;
                    }
                    router.refresh();
                  }

                  async function handleResume() {
                    setPendingId(s.id);
                    const res = await resumeSubscriptionAction(s.id);
                    setPendingId(null);
                    if (!res.ok) {
                      window.alert(res.message);
                      return;
                    }
                    router.refresh();
                  }

                  async function handleCancel() {
                    if (
                      !window.confirm(
                        "Cancel this subscription at the end of the current billing period? No refund will be issued.",
                      )
                    ) {
                      return;
                    }
                    setPendingId(s.id);
                    const res = await cancelSubscriptionAction(s.id);
                    setPendingId(null);
                    if (!res.ok) {
                      window.alert(res.message);
                      return;
                    }
                    router.refresh();
                  }

                  async function handleDelete() {
                    if (
                      !window.confirm(
                        "Delete this subscription now? This immediately cancels it in Stripe.",
                      )
                    ) {
                      return;
                    }
                    setPendingId(s.id);
                    const res = await deleteSubscriptionAction(s.id);
                    setPendingId(null);
                    if (!res.ok) {
                      window.alert(res.message);
                      return;
                    }
                    router.refresh();
                  }

                  return (
                    <motion.tr
                      key={s.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, delay: index * 0.012 }}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={() => toggleOne(s.id)}
                          className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                          aria-label={`Select subscription for ${row.accountName}`}
                        />
                      </td>
                      <td className="max-w-[260px] px-4 py-3 align-middle">{accountCell}</td>
                      <td className="px-4 py-3 align-middle">
                        <Badge
                          variant="outline"
                          className={cn("border-transparent font-medium capitalize", st.className)}
                        >
                          {st.label}
                        </Badge>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 align-middle text-muted-foreground">
                        {s.productName?.trim() || "—"}
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
                        {formatTableDate(s.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                        {formatTableDate(s.subscriptionEnd ?? s.currentPeriodEnd)}
                      </td>
                      <td className="px-2 py-3 text-center align-middle">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={rowBusy}
                              className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Actions for subscription ${s.id}`}
                            >
                              {rowBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" aria-hidden />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="min-w-[11rem] border-border/80 bg-popover text-popover-foreground shadow-lg"
                          >
                            <DropdownMenuItem
                              onSelect={() =>
                                window.open(`https://dashboard.stripe.com/subscriptions/${s.id}`, "_blank")
                              }
                            >
                              Open in Stripe
                            </DropdownMenuItem>
                            {pauseAllowed ? (
                              <DropdownMenuItem onSelect={() => void handlePause()}>Pause</DropdownMenuItem>
                            ) : null}
                            {resumeAllowed ? (
                              <DropdownMenuItem onSelect={() => void handleResume()}>Resume</DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onSelect={() => void handleCancel()}>
                              Cancel
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => void handleDelete()}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
