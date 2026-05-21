"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Filter, ListChecks, Loader2, MoreHorizontal, Plus, Search } from "lucide-react";
import {
  activateCatalogServiceAction,
  archiveCatalogServiceAction,
  deleteCatalogServiceAction,
  syncCatalogServiceStripeAction,
} from "@/server/actions/catalog-services";
import { AddCatalogServiceModal } from "@/components/portal/add-catalog-service-modal";
import { formatCurrencyAmount } from "@/lib/format";
import type { CatalogServiceKind, CatalogServiceRecord, CatalogServiceStatus } from "@/types/catalog-service";
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

function pricingLabel(service: CatalogServiceRecord): string {
  const terms = service.terms;
  if (terms.length === 0) return "—";

  const amounts = terms.map((t) => t.monthlyAmountMinor);
  const distinct = new Set(amounts);

  if (terms.length === 1 || distinct.size === 1) {
    const amount = amounts[0] ?? 0;
    return amount > 0 ? formatCurrencyAmount(amount, service.currency) : "—";
  }

  return "Multiple";
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

function statusBadge(status: CatalogServiceStatus): { label: string; className: string } {
  if (status === "active") {
    return {
      label: "Active",
      className: "bg-emerald-500/15 text-emerald-400",
    };
  }
  if (status === "draft") {
    return {
      label: "Draft",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  return {
    label: "Archived",
    className: "bg-muted text-muted-foreground",
  };
}

function serviceTypeLabel(serviceType: CatalogServiceKind | undefined): string {
  if (serviceType === "plan") return "Plan";
  if (serviceType === "addon") return "Add-on";
  return "—";
}

function stripeSyncLabel(service: CatalogServiceRecord): string {
  if (!service.stripeProductId?.trim()) return "Not synced";
  if (service.stripeSyncedAt) return "Synced";
  return "Linked";
}

type ServiceStatusFilter = "all" | CatalogServiceStatus;
type ServiceTypeFilter = "all" | CatalogServiceKind;

function matchesStatusFilter(service: CatalogServiceRecord, statusFilter: ServiceStatusFilter): boolean {
  if (statusFilter === "all") return true;
  return service.status === statusFilter;
}

function matchesTypeFilter(service: CatalogServiceRecord, typeFilter: ServiceTypeFilter): boolean {
  if (typeFilter === "all") return true;
  return service.serviceType === typeFilter;
}

export interface CatalogServicesListPanelProps {
  services: CatalogServiceRecord[];
}

export function CatalogServicesListPanel({ services }: CatalogServicesListPanelProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ServiceStatusFilter>("all");
  const [typeFilter, setTypeFilter] = React.useState<ServiceTypeFilter>("all");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [addOpen, setAddOpen] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  React.useEffect(() => {
    router.refresh();
  }, [router]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((service) => {
      if (!matchesStatusFilter(service, statusFilter)) return false;
      if (!matchesTypeFilter(service, typeFilter)) return false;
      if (!q) return true;
      const hay = [
        service.name,
        service.slug,
        service.serviceType,
        service.status,
        service.stripeProductId,
        service.currency,
        String(service.includedUsers),
        String(service.includedLocations),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [services, query, statusFilter, typeFilter]);

  const filteredIds = React.useMemo(() => filtered.map((s) => s.id), [filtered]);
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
        `Delete ${ids.length} selected service${ids.length === 1 ? "" : "s"} permanently? Linked Stripe products will be deactivated if present.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    const failed: string[] = [];
    for (const id of ids) {
      const res = await deleteCatalogServiceAction(id);
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
      <AddCatalogServiceModal open={addOpen} onOpenChange={setAddOpen} />

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Services</h1>
          <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>Product catalogue synced to Stripe</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add service
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
                placeholder="Search name, status, slug, Stripe id..."
                className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
                aria-label="Search services"
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
                  onChange={(e) => setStatusFilter(e.target.value as ServiceStatusFilter)}
                  className={cn(
                    "h-9 appearance-none rounded-full border border-border/80 bg-background/60 py-0 pl-8 pr-8 text-[13px] font-medium text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as ServiceTypeFilter)}
                  className={cn(
                    "h-9 appearance-none rounded-full border border-border/80 bg-background/60 py-0 sm:pl-3 pr-8 text-[13px] font-medium text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label="Filter by type"
                >
                  <option value="all">All types</option>
                  <option value="plan">Plan</option>
                  <option value="addon">Add-on</option>
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
          <table className="w-full min-w-[880px] text-left text-[13px]">
            <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="w-12 px-4 py-2.5">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                  aria-label="Select all visible services"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Service name</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Pricing</th>
                <th className="px-4 py-2.5 font-medium">Stripe</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="w-14 px-2 py-2.5 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <p className="mx-auto max-w-md leading-relaxed">No services yet.</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No services match your filters.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {filtered.map((service, index) => {
                    const st = statusBadge(service.status);
                    const rowBusy = pendingId === service.id || bulkBusy;

                    async function runRowAction(
                      fn: () => Promise<{ ok: boolean; message?: string }>,
                    ) {
                      setPendingId(service.id);
                      const res = await fn();
                      setPendingId(null);
                      if (!res.ok) {
                        window.alert(res.message);
                        return;
                      }
                      router.refresh();
                    }

                    return (
                      <motion.tr
                        key={service.id}
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
                            checked={selected.has(service.id)}
                            onChange={() => toggleOne(service.id)}
                            className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                            aria-label={`Select ${service.name}`}
                          />
                        </td>
                        <td className="max-w-[280px] px-4 py-3 align-middle">
                          <Link
                            href={`/admin/services/${service.id}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {service.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <Badge
                            variant="outline"
                            className={cn("border-transparent font-medium capitalize", st.className)}
                          >
                            {st.label}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                          {serviceTypeLabel(service.serviceType)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-muted-foreground">
                          {pricingLabel(service)}
                        </td>
                        <td className="px-4 py-3 align-middle text-muted-foreground">
                          {stripeSyncLabel(service)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                          {formatTableDate(service.updatedAt)}
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
                                aria-label={`Actions for ${service.name}`}
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
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/services/${service.id}`}>Edit</Link>
                              </DropdownMenuItem>
                              {service.stripeProductId ? (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    window.open(
                                      `https://dashboard.stripe.com/products/${service.stripeProductId}`,
                                      "_blank",
                                    )
                                  }
                                >
                                  Open in Stripe
                                </DropdownMenuItem>
                              ) : null}
                              {service.status === "draft" ? (
                                <DropdownMenuItem
                                  onSelect={() => void runRowAction(() => activateCatalogServiceAction(service.id))}
                                >
                                  Activate & sync
                                </DropdownMenuItem>
                              ) : null}
                              {service.status === "active" ? (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    void runRowAction(() => syncCatalogServiceStripeAction(service.id))
                                  }
                                >
                                  Re-sync prices
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              {service.status !== "archived" ? (
                                <DropdownMenuItem
                                  onSelect={() => {
                                    if (
                                      !window.confirm(
                                        "Archive this service? It will be hidden from new proposals and subscriptions.",
                                      )
                                    ) {
                                      return;
                                    }
                                    void runRowAction(() => archiveCatalogServiceAction(service.id));
                                  }}
                                >
                                  Archive
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => {
                                  if (
                                    !window.confirm(
                                      "Delete this service permanently? It will be removed from the catalogue. Linked Stripe product will be deactivated if present; existing subscriptions are not changed.",
                                    )
                                  ) {
                                    return;
                                  }
                                  void runRowAction(() => deleteCatalogServiceAction(service.id));
                                }}
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
