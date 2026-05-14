"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, ExternalLink, Loader2, Pencil, Search, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import type { ProposalHubListRow, ProposalRecord } from "@/types/proposal";
import { cloneProposalAction, deleteProposalAction } from "@/server/actions/proposal-builder";
import { formatLastEditedInLocality } from "@/lib/proposal-locality-dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ProposalsListPanelProps {
  proposals: ProposalHubListRow[];
  /** Settings → Locality IANA zone for “Last edited” timestamps. */
  localityTimeZone?: string;
}

type ProposalLifecyclePhase = "draft" | "published" | "viewed";

function proposalLifecyclePhase(p: ProposalRecord): ProposalLifecyclePhase {
  const viewed =
    p.status === "viewed" ||
    p.status === "accepted" ||
    p.status === "declined" ||
    (typeof p.viewCount === "number" && p.viewCount > 0) ||
    (typeof p.lastViewedAtMs === "number" && p.lastViewedAtMs > 0);
  if (viewed) return "viewed";
  if (p.status !== "draft") return "published";
  return "draft";
}

const HUB_BADGE: Record<string, string> = {
  draft:
    "border-slate-500/45 bg-slate-500/10 text-slate-800 dark:border-slate-500/35 dark:bg-slate-500/15 dark:text-slate-200",
  published:
    "border-sky-500/45 bg-sky-500/10 text-sky-900 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-200",
  viewed:
    "border-emerald-500/45 bg-emerald-500/10 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200",
  accepted:
    "border-emerald-600/50 bg-emerald-600/12 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-600/18 dark:text-emerald-100",
  declined: "border-destructive/40 bg-destructive/10 text-destructive dark:text-destructive",
  expired: "border-border bg-muted/50 text-muted-foreground",
};

function proposalHubStageDisplay(p: ProposalRecord): {
  label: string;
  title: string;
  badgeKey: keyof typeof HUB_BADGE;
} {
  if (p.status === "accepted") {
    return {
      label: "Accepted",
      title: "The client accepted this proposal on the public page.",
      badgeKey: "accepted",
    };
  }
  if (p.status === "declined") {
    return {
      label: "Declined",
      title: "The client declined this proposal.",
      badgeKey: "declined",
    };
  }
  if (p.status === "expired") {
    return {
      label: "Expired",
      title: "This proposal is no longer active.",
      badgeKey: "expired",
    };
  }
  const phase = proposalLifecyclePhase(p);
  if (phase === "draft") {
    return {
      label: "Draft",
      title: "Draft — not published to a public link yet.",
      badgeKey: "draft",
    };
  }
  if (phase === "published") {
    return {
      label: "Published",
      title: "Published — public link is active; no recorded opens yet.",
      badgeKey: "published",
    };
  }
  return {
    label: "Viewed",
    title: "Viewed — recipient has opened or interacted with the public proposal.",
    badgeKey: "viewed",
  };
}

function lastEditedMs(p: ProposalRecord): number {
  return (typeof p.updatedAtMs === "number" && p.updatedAtMs > 0 ? p.updatedAtMs : p.createdAtMs) || 0;
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
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [cloningId, setCloningId] = React.useState<string | null>(null);

  const sorted = React.useMemo(
    () => [...proposals].sort((a, b) => lastEditedMs(b) - lastEditedMs(a)),
    [proposals],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => {
      const stage = proposalHubStageDisplay(p);
      const hay = [p.accountCompanyName, p.title, stage.label, formatLastEditedInLocality(lastEditedMs(p), localityTimeZone)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sorted, query, localityTimeZone]);

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
              placeholder="Search account, title, status, or date…"
              className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
              aria-label="Search proposals by account, title, status, or date"
            />
          </div>
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Account name</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="min-w-[180px] px-4 py-2.5 font-medium">Last edited</th>
              <th className="w-[168px] px-2 py-2.5 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <p className="mx-auto max-w-md leading-relaxed">
                    No proposals yet. Create one from a contact or opportunity in the CRM.
                  </p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No proposals match your search.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.map((p, index) => {
                  const stage = proposalHubStageDisplay(p);
                  const edited = lastEditedMs(p);
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
                      <td className="max-w-[280px] px-4 py-3 align-middle">
                        <Link
                          href={editHref(p)}
                          className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {p.accountCompanyName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge
                          variant="outline"
                          title={stage.title}
                          className={cn("text-xs font-medium capitalize", HUB_BADGE[stage.badgeKey])}
                        >
                          {stage.label}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground tabular-nums">
                        <time dateTime={edited > 0 ? new Date(edited).toISOString() : undefined}>
                          {formatLastEditedInLocality(edited, localityTimeZone)}
                        </time>
                      </td>
                      <td className="px-2 py-3 align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={deletingId === p.id}
                            aria-label={`Delete proposal “${p.title}”`}
                            onClick={() => void onDelete(p)}
                          >
                            {deletingId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={cloningId === p.id}
                            aria-label={`Clone proposal “${p.title}”`}
                            onClick={() => void onClone(p)}
                          >
                            {cloningId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden />
                            )}
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                            <Link href={editHref(p)} aria-label={`Edit proposal “${p.title}”`}>
                              <Pencil className="h-4 w-4" aria-hidden />
                            </Link>
                          </Button>
                          {p.shareToken ? (
                            <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                              <Link
                                href={`/p/${p.shareToken}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open public preview for “${p.title}”`}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden />
                              </Link>
                            </Button>
                          ) : null}
                        </div>
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
