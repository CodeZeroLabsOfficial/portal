"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import {
  activateCatalogServiceAction,
  archiveCatalogServiceAction,
  deleteCatalogServiceAction,
  syncCatalogServiceStripeAction,
} from "@/server/actions/catalog-services";
import { AddCatalogServiceModal } from "@/components/portal/add-catalog-service-modal";
import { formatCurrencyAmount } from "@/lib/format";
import type { CatalogServiceRecord, CatalogServiceStatus } from "@/types/catalog-service";
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

function termMinor(service: CatalogServiceRecord, months: 12 | 24): number {
  const match = service.terms.find((t) => t.months === months);
  if (match) return match.monthlyAmountMinor;
  if (service.pricingModel === "flat" && service.terms.length === 1) {
    return service.terms[0]!.monthlyAmountMinor;
  }
  return 0;
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
      className: "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    };
  }
  if (status === "draft") {
    return {
      label: "Draft",
      className: "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300",
    };
  }
  return {
    label: "Archived",
    className: "border-border bg-muted/50 text-muted-foreground",
  };
}

function stripeSyncLabel(service: CatalogServiceRecord): string {
  if (!service.stripeProductId?.trim()) return "Not synced";
  if (service.stripeSyncedAt) return "Synced";
  return "Linked";
}

export interface CatalogServicesListPanelProps {
  services: CatalogServiceRecord[];
}

export function CatalogServicesListPanel({ services }: CatalogServicesListPanelProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    router.refresh();
  }, [router]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((service) => {
      const hay = [
        service.name,
        service.slug,
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
  }, [services, query]);

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
          <div className="relative min-w-0 flex-1 sm:max-w-md">
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Service name</th>
                <th className="px-4 py-2.5 font-medium">12 mo monthly</th>
                <th className="px-4 py-2.5 font-medium">24 mo monthly</th>
                <th className="px-4 py-2.5 font-medium">Stripe</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="w-14 px-2 py-2.5 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <p className="mx-auto max-w-md leading-relaxed">No services yet.</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No services match your search.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {filtered.map((service, index) => {
                    const st = statusBadge(service.status);

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
                          <Badge variant="outline" className={cn("font-normal", st.className)}>
                            {st.label}
                          </Badge>
                        </td>
                        <td className="max-w-[280px] px-4 py-3 align-middle">
                          <Link
                            href={`/admin/services/${service.id}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {service.name}
                          </Link>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {service.slug}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-muted-foreground">
                          {formatCurrencyAmount(termMinor(service, 12), service.currency)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-muted-foreground">
                          {formatCurrencyAmount(termMinor(service, 24), service.currency)}
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
                                disabled={pendingId === service.id}
                                className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={`Actions for ${service.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-[11rem] border-border/80 bg-popover text-popover-foreground shadow-lg"
                            >
                              <DropdownMenuItem onSelect={() => router.push(`/admin/services/${service.id}`)}>
                                Edit
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
