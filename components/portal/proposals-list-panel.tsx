"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ListChecks, Loader2, MoreHorizontal, Search } from "lucide-react";
import type { ProposalHubListRow, ProposalRecord } from "@/types/proposal";
import { cloneProposalAction, deleteProposalAction } from "@/server/actions/proposal-builder";
import { formatLastEditedInLocality } from "@/lib/proposal-locality-dates";
import { ProposalStageBadge } from "@/components/portal/proposal-stage-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getProposalStageBadgeDisplay } from "@/lib/proposal-status-badge";

export interface ProposalsListPanelProps {
  proposals: ProposalHubListRow[];
  /** Settings → Locality IANA zone for “Last edited” timestamps. */
  localityTimeZone?: string;
}

function lastEditedMs(p: ProposalRecord): number {
  return (typeof p.updatedAt === "number" && p.updatedAt > 0 ? p.updatedAt : p.createdAt) || 0;
}

function editHref(p: ProposalRecord): string {
  const base = `/admin/proposals/${p.id}`;
  if (p.customerId) return `${base}?customer=${encodeURIComponent(p.customerId)}`;
  return base;
}

export function ProposalsListPanel({ proposals, localityTimeZone }: ProposalsListPanelProps) {
  const router = useRouter();

  React.useEffect(() => {
    router.refresh();
  }, [router]);

  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [cloningId, setCloningId] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const sorted = React.useMemo(
    () => [...proposals].sort((a, b) => lastEditedMs(b) - lastEditedMs(a)),
    [proposals],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => {
      const stage = getProposalStageBadgeDisplay(p);
      const hay = [
        p.accountCompanyName,
        p.contactName,
        p.title,
        stage.label,
        formatLastEditedInLocality(lastEditedMs(p), localityTimeZone),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sorted, query, localityTimeZone]);

  const filteredIds = React.useMemo(() => filtered.map((p) => p.id), [filtered]);
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

  async function onDelete(p: ProposalHubListRow) {
    if (!window.confirm(`Delete proposal “${p.title}”? This cannot be undone.`)) return;
    setDeletingId(p.id);
    try {
      const res = await deleteProposalAction(p.id);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function onClone(p: ProposalHubListRow) {
    setCloningId(p.id);
    try {
      const res = await cloneProposalAction(p.id);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      const href = p.customerId
        ? `/admin/proposals/${res.proposalId}?customer=${encodeURIComponent(p.customerId)}`
        : `/admin/proposals/${res.proposalId}`;
      router.push(href);
      router.refresh();
    } finally {
      setCloningId(null);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} selected proposal${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    const failed: string[] = [];
    for (const id of ids) {
      const res = await deleteProposalAction(id);
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
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="shrink-0 text-sm font-semibold text-foreground">Customer proposals</h2>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs md:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search account, contact, title, status, or date…"
              className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
              aria-label="Search proposals by account, contact, title, status, or date"
            />
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="w-12 px-4 py-2.5">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                  aria-label="Select all visible proposals"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Account name</th>
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="min-w-[180px] px-4 py-2.5 font-medium">Last edited</th>
              <th className="w-14 px-2 py-2.5 text-center font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <p className="mx-auto max-w-md leading-relaxed">
                    No proposals yet. Create one from a contact or opportunity in the CRM.
                  </p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No proposals match your search.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.map((p, index) => {
                  const edited = lastEditedMs(p);
                  const rowBusy = deletingId === p.id || cloningId === p.id || bulkBusy;
                  return (
                    <motion.tr
                      key={p.id}
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
                          checked={selected.has(p.id)}
                          onChange={() => toggleOne(p.id)}
                          className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                          aria-label={`Select ${p.accountCompanyName}`}
                        />
                      </td>
                      <td className="max-w-[220px] px-4 py-3 align-middle">
                        <Link
                          href={editHref(p)}
                          className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {p.accountCompanyName}
                        </Link>
                      </td>
                      <td className="max-w-[200px] px-4 py-3 align-middle">
                        {p.contactName.trim() && p.contactName !== "—" ? (
                          p.customerId ? (
                            <Link
                              href={`/admin/customers/${p.customerId}`}
                              className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:underline"
                            >
                              {p.contactName}
                            </Link>
                          ) : (
                            <span className="line-clamp-2 font-medium text-foreground">{p.contactName}</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <ProposalStageBadge proposal={p} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground tabular-nums">
                        <time dateTime={edited > 0 ? new Date(edited).toISOString() : undefined}>
                          {formatLastEditedInLocality(edited, localityTimeZone)}
                        </time>
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
                              aria-label={`Actions for ${p.title}`}
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
                              <Link href={editHref(p)}>Edit</Link>
                            </DropdownMenuItem>
                            {p.shareToken ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/p/${p.shareToken}`} target="_blank" rel="noopener noreferrer">
                                  Preview
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem disabled={cloningId === p.id} onClick={() => void onClone(p)}>
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={deletingId === p.id}
                              className="text-destructive focus:text-destructive"
                              onClick={() => void onDelete(p)}
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
  );
}
