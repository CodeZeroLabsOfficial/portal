"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Filter, MoreHorizontal, Plus, Search, SquareArrowOutUpRight } from "lucide-react";
import type { CustomerListRow } from "@/lib/customer-list";
import type { CustomerSubscriptionRollup } from "@/types/customer";
import { archiveCustomerAction, deleteCustomerAction } from "@/server/actions/customers-crm";
import { AddCustomerModal } from "@/components/portal/add-customer-modal";
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
import { cn } from "@/lib/utils";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function subscriptionBadgeVariant(
  rollup: CustomerSubscriptionRollup,
): "default" | "secondary" | "destructive" | "outline" {
  if (rollup === "active" || rollup === "trialing") return "default";
  if (rollup === "past_due" || rollup === "canceled") return "destructive";
  if (rollup === "mixed") return "secondary";
  return "outline";
}

function subscriptionLabel(rollup: CustomerSubscriptionRollup): string {
  if (rollup === "none") return "No subscription";
  if (rollup === "mixed") return "Mixed";
  return rollup.replace(/_/g, " ");
}

function CustomerAvatar({ row }: { row: CustomerListRow }) {
  const url = row.avatarUrl?.trim();
  const canUseNextImage =
    url &&
    (url.includes("googleusercontent.com") || url.includes("firebasestorage.googleapis.com"));

  if (url && canUseNextImage) {
    return (
      <span className="relative inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        <Image src={url} alt="" width={36} height={36} className="h-9 w-9 object-cover" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-1 ring-border"
      aria-hidden
    >
      {initialsFromName(row.name)}
    </span>
  );
}

export interface CustomerListPanelProps {
  rows: CustomerListRow[];
  /** When false, CRM writes are disabled — staff profile needs `organizationId`. */
  hasOrganization: boolean;
}

export function CustomerListPanel({ rows, hasOrganization }: CustomerListPanelProps) {
  const router = useRouter();

  /** Next.js can reuse a stale RSC payload when returning to this route; refresh forces a server re-read. */
  React.useEffect(() => {
    router.refresh();
  }, [router]);

  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "archived">("active");
  const [tagFilter, setTagFilter] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [addOpen, setAddOpen] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const tag = tagFilter.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (tag && !row.tags.some((t) => t.toLowerCase().includes(tag))) return false;
      if (!q) return true;
      const hay = [row.name, row.email, row.phone, row.location, row.company, row.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, statusFilter, tagFilter]);

  const filteredIds = React.useMemo(() => filtered.map((r) => r.id), [filtered]);
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

  async function handleArchive(id: string, archived: boolean) {
    setPendingId(id);
    const res = await archiveCustomerAction(id, archived);
    setPendingId(null);
    if (res.ok) router.refresh();
    else window.alert(res.message);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Permanently delete this customer and related notes? This cannot be undone.")) {
      return;
    }
    setPendingId(id);
    const res = await deleteCustomerAction(id);
    setPendingId(null);
    if (res.ok) router.refresh();
    else window.alert(res.message);
  }

  return (
    <div className="space-y-8">
      <AddCustomerModal open={addOpen} onOpenChange={setAddOpen} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem] md:leading-tight">
            Customers
          </h1>
        </motion.div>
        <Button
          type="button"
          size="sm"
          className="gap-1.5 shadow-sm"
          disabled={!hasOrganization}
          title={!hasOrganization ? "Set an organization on your staff account first." : undefined}
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add customer
        </Button>
      </div>

      {!hasOrganization ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your account does not have an <span className="font-mono">organizationId</span>. CRM lists and writes are
          disabled until it is set on your user document (see Settings / provisioning).
        </div>
      ) : null}

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
                placeholder="Search name, email, company, tags…"
                className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
                aria-label="Search customers"
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
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className={cn(
                    "h-9 appearance-none rounded-full border border-border/80 bg-background/60 py-0 pl-8 pr-8 text-[13px] font-medium text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label="Filter by status"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="all">All statuses</option>
                </select>
              </div>
              <Input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Tag contains…"
                className="h-9 w-[140px] rounded-full border-border/80 bg-background/60 text-[13px] sm:w-[160px]"
                aria-label="Filter by tag"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 border-border/80 bg-card/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label="Export (soon)"
                disabled
                title="Export coming soon"
              >
                <SquareArrowOutUpRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="w-12 px-4 py-2.5">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                    aria-label="Select all visible customers"
                  />
                </th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Billing</th>
                <th className="px-4 py-2.5 font-medium">Tags</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="w-14 px-2 py-2.5 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {!hasOrganization ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Organization required to load CRM data.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <p className="mx-auto max-w-md leading-relaxed">
                      No customers yet. Add your first profile, or sync from Stripe by linking a{" "}
                      <span className="font-mono text-foreground/90">cus_</span> id on the customer detail page.
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No customers match your filters.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {filtered.map((row, index) => (
                    <motion.tr
                      key={row.id}
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
                          checked={selected.has(row.id)}
                          onChange={() => toggleOne(row.id)}
                          className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                          aria-label={`Select ${row.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Link
                          href={`/admin/customers/${row.id}`}
                          className="flex items-center gap-3 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <CustomerAvatar row={row} />
                          <span className="font-medium text-foreground underline-offset-4 hover:underline">
                            {row.name}
                          </span>
                        </Link>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 align-middle text-muted-foreground">
                        {row.email}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 align-middle text-muted-foreground">
                        {row.company?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge variant={subscriptionBadgeVariant(row.subscriptionRollup)} className="font-normal capitalize">
                          {subscriptionLabel(row.subscriptionRollup)}
                        </Badge>
                      </td>
                      <td className="max-w-[180px] px-4 py-3 align-middle">
                        <div className="flex flex-wrap gap-1">
                          {row.tags.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            row.tags.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                              >
                                {t}
                              </span>
                            ))
                          )}
                          {row.tags.length > 4 ? (
                            <span className="text-[11px] text-muted-foreground">+{row.tags.length - 4}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            row.status === "archived"
                              ? "bg-muted text-muted-foreground"
                              : "bg-emerald-500/15 text-emerald-400",
                          )}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center align-middle">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={pendingId === row.id}
                              className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Actions for ${row.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="min-w-[10rem] border-border/80 bg-popover text-popover-foreground shadow-lg"
                          >
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/customers/${row.id}`}>Open profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleArchive(row.id, row.status !== "archived")}
                            >
                              {row.status === "archived" ? "Restore" : "Archive"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(row.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
