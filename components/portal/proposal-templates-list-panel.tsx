"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Filter, ListChecks, Loader2, MoreHorizontal, Search } from "lucide-react";
import type { ContractTemplateRecord } from "@/types/contract-template";
import type {
  ProposalTemplateRecord,
  ProposalTemplateStage,
  ProposalTemplateType,
} from "@/types/proposal-template";
import {
  cloneContractTemplateAction,
  deleteContractTemplateAction,
  setContractTemplateStageAction,
} from "@/server/actions/contract-templates";
import {
  cloneProposalTemplateAction,
  deleteProposalTemplateAction,
  setProposalTemplateStageAction,
} from "@/server/actions/proposal-templates";
import { formatLastEditedInLocality } from "@/lib/proposal-locality-dates";
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

export interface ProposalTemplatesListPanelProps {
  proposalTemplates: ProposalTemplateRecord[];
  contractTemplates?: ContractTemplateRecord[];
  localityTimeZone?: string;
}

type TemplatesListEntry =
  | { kind: "proposal"; row: ProposalTemplateRecord }
  | { kind: "contract"; row: ContractTemplateRecord };

function listEntryKey(entry: TemplatesListEntry): string {
  return entry.kind === "proposal" ? `proposal:${entry.row.id}` : `contract:${entry.row.id}`;
}

function lastEditedMsProposal(t: ProposalTemplateRecord): number {
  return (typeof t.updatedAt === "number" && t.updatedAt > 0 ? t.updatedAt : t.createdAt) || 0;
}

function lastEditedMsContract(t: ContractTemplateRecord): number {
  return Math.max(t.updatedAt ?? 0, t.createdAt ?? 0);
}

function lastEditedMs(entry: TemplatesListEntry): number {
  return entry.kind === "proposal" ? lastEditedMsProposal(entry.row) : lastEditedMsContract(entry.row);
}

const TEMPLATE_STAGE_BADGE: Record<ProposalTemplateStage, string> = {
  draft:
    "border-slate-500/45 bg-slate-500/10 text-slate-800 dark:border-slate-500/35 dark:bg-slate-500/15 dark:text-slate-200",
  published:
    "border-sky-500/45 bg-sky-500/10 text-sky-900 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-200",
};

function proposalTemplateTypeLabel(templateType: ProposalTemplateType): string {
  if (templateType === "contract") return "Contract";
  return "Proposal";
}

function templateTypeLabel(entry: TemplatesListEntry): string {
  if (entry.kind === "contract") return "Contract";
  return proposalTemplateTypeLabel(entry.row.templateType);
}

function templateStage(entry: TemplatesListEntry): ProposalTemplateStage {
  return entry.row.stage;
}

function templateName(entry: TemplatesListEntry): string {
  return entry.row.name;
}

function templateStageDisplay(stage: ProposalTemplateStage): {
  label: string;
  title: string;
  badgeClass: string;
} {
  if (stage === "published") {
    return {
      label: "Published",
      title: "Marked ready for CRM and customer proposals.",
      badgeClass: TEMPLATE_STAGE_BADGE.published,
    };
  }
  return {
    label: "Draft",
    title: "Still in progress — publish when the template is ready to use.",
    badgeClass: TEMPLATE_STAGE_BADGE.draft,
  };
}

function editHref(entry: TemplatesListEntry): string {
  return entry.kind === "proposal"
    ? `/admin/templates/${entry.row.id}`
    : `/admin/templates/contracts/${entry.row.id}`;
}

function previewHref(entry: TemplatesListEntry): string {
  return entry.kind === "proposal"
    ? `/admin/templates/${entry.row.id}/preview`
    : `/admin/templates/contracts/${entry.row.id}/preview`;
}

type TemplateTypeFilter = "all" | "proposal" | "contract";
type TemplateStageFilter = "all" | ProposalTemplateStage;

function matchesTypeFilter(entry: TemplatesListEntry, typeFilter: TemplateTypeFilter): boolean {
  if (typeFilter === "all") return true;
  if (typeFilter === "proposal") {
    return entry.kind === "proposal" && entry.row.templateType === "proposal";
  }
  if (entry.kind === "contract") return true;
  return entry.kind === "proposal" && entry.row.templateType === "contract";
}

function matchesStageFilter(entry: TemplatesListEntry, stageFilter: TemplateStageFilter): boolean {
  if (stageFilter === "all") return true;
  return templateStage(entry) === stageFilter;
}

export function ProposalTemplatesListPanel({
  proposalTemplates,
  contractTemplates = [],
  localityTimeZone,
}: ProposalTemplatesListPanelProps) {
  const router = useRouter();

  React.useEffect(() => {
    router.refresh();
  }, [router]);

  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TemplateTypeFilter>("all");
  const [stageFilter, setStageFilter] = React.useState<TemplateStageFilter>("all");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [deletingKey, setDeletingKey] = React.useState<string | null>(null);
  const [stageUpdatingKey, setStageUpdatingKey] = React.useState<string | null>(null);
  const [cloningKey, setCloningKey] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const entries = React.useMemo((): TemplatesListEntry[] => {
    const proposalRows: TemplatesListEntry[] = proposalTemplates.map((row) => ({
      kind: "proposal",
      row,
    }));
    const contractRows: TemplatesListEntry[] = contractTemplates.map((row) => ({
      kind: "contract",
      row,
    }));
    return [...proposalRows, ...contractRows].sort((a, b) => lastEditedMs(b) - lastEditedMs(a));
  }, [proposalTemplates, contractTemplates]);

  async function deleteEntry(entry: TemplatesListEntry) {
    const name = templateName(entry);
    if (entry.kind === "proposal") {
      if (!window.confirm(`Delete template “${name}”? This cannot be undone.`)) return;
      setDeletingKey(listEntryKey(entry));
      try {
        const res = await deleteProposalTemplateAction(entry.row.id);
        if (!res.ok) {
          window.alert(res.message);
          return;
        }
        router.refresh();
      } finally {
        setDeletingKey(null);
      }
      return;
    }

    if (
      !window.confirm(
        `Delete contract template “${name}”? Proposals that already copied its text are unchanged.`,
      )
    ) {
      return;
    }
    setDeletingKey(listEntryKey(entry));
    try {
      const res = await deleteContractTemplateAction(entry.row.id);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.refresh();
    } finally {
      setDeletingKey(null);
    }
  }

  async function updateStage(entry: TemplatesListEntry, stage: ProposalTemplateStage) {
    const key = listEntryKey(entry);
    setStageUpdatingKey(key);
    try {
      const res =
        entry.kind === "proposal"
          ? await setProposalTemplateStageAction(entry.row.id, stage)
          : await setContractTemplateStageAction(entry.row.id, stage);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.refresh();
    } finally {
      setStageUpdatingKey(null);
    }
  }

  async function cloneEntry(entry: TemplatesListEntry) {
    const key = listEntryKey(entry);
    setCloningKey(key);
    try {
      if (entry.kind === "proposal") {
        const res = await cloneProposalTemplateAction(entry.row.id);
        if (!res.ok) {
          window.alert(res.message);
          return;
        }
        router.push(`/admin/templates/${res.templateId}`);
      } else {
        const res = await cloneContractTemplateAction(entry.row.id);
        if (!res.ok) {
          window.alert(res.message);
          return;
        }
        router.push(`/admin/templates/contracts/${res.contractTemplateId}`);
      }
      router.refresh();
    } finally {
      setCloningKey(null);
    }
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!matchesTypeFilter(entry, typeFilter)) return false;
      if (!matchesStageFilter(entry, stageFilter)) return false;
      if (!q) return true;
      const desc = (entry.row.description ?? "").trim();
      const stageLabel = templateStageDisplay(templateStage(entry)).label;
      const typeLabel = templateTypeLabel(entry);
      const agreementTitle = entry.kind === "contract" ? entry.row.agreementTitle : "";
      const hay = [
        templateName(entry),
        desc,
        typeLabel,
        agreementTitle,
        stageLabel,
        formatLastEditedInLocality(lastEditedMs(entry), localityTimeZone),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query, typeFilter, stageFilter, localityTimeZone]);

  const filteredKeys = React.useMemo(() => filtered.map((entry) => listEntryKey(entry)), [filtered]);
  const allFilteredSelected =
    filteredKeys.length > 0 && filteredKeys.every((key) => selected.has(key));
  const someFilteredSelected = filteredKeys.some((key) => selected.has(key));
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
        for (const key of filteredKeys) next.delete(key);
      } else {
        for (const key of filteredKeys) next.add(key);
      }
      return next;
    });
  }

  function toggleOne(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleBulkDelete() {
    const keys = Array.from(selected);
    if (keys.length === 0) return;
    if (
      !window.confirm(
        `Delete ${keys.length} selected template${keys.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    const failed: string[] = [];
    for (const key of keys) {
      const entry = entries.find((e) => listEntryKey(e) === key);
      if (!entry) continue;
      const res =
        entry.kind === "proposal"
          ? await deleteProposalTemplateAction(entry.row.id)
          : await deleteContractTemplateAction(entry.row.id);
      if (!res.ok) failed.push(key);
    }
    setBulkBusy(false);
    if (failed.length > 0) {
      window.alert(`Deleted ${keys.length - failed.length} of ${keys.length}. ${failed.length} failed.`);
    } else {
      setSelected(new Set());
    }
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="shrink-0 text-sm font-semibold text-foreground">Templates</h2>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs md:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, type, stage, or date…"
              className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
              aria-label="Search templates"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative">
              <Filter
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TemplateTypeFilter)}
                className={cn(
                  "h-9 appearance-none rounded-full border border-border/80 bg-background/60 py-0 pl-8 pr-8 text-[13px] font-medium text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                aria-label="Filter by type"
              >
                <option value="all">All types</option>
                <option value="proposal">Proposal</option>
                <option value="contract">Contract</option>
              </select>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as TemplateStageFilter)}
                className={cn(
                  "h-9 appearance-none rounded-full border border-border/80 bg-background/60 py-0 sm:pl-3 pr-8 text-[13px] font-medium text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                aria-label="Filter by stage"
              >
                <option value="all">All stages</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
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
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="w-12 px-4 py-2.5">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                  aria-label="Select all visible templates"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Template name</th>
              <th className="min-w-[100px] px-4 py-2.5 font-medium">Type</th>
              <th className="min-w-[120px] px-4 py-2.5 font-medium">Stage</th>
              <th className="min-w-[180px] px-4 py-2.5 font-medium">Last edited date</th>
              <th className="w-14 px-2 py-2.5 text-center font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <p className="mx-auto max-w-md leading-relaxed">
                    No templates yet. Use <span className="font-medium text-foreground">New template</span> or{" "}
                    <span className="font-medium text-foreground">New contract template</span> to create reusable
                    content for proposals and agreements.
                  </p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No templates match your filters.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.map((entry, index) => {
                  const key = listEntryKey(entry);
                  const name = templateName(entry);
                  const edited = lastEditedMs(entry);
                  const stage = templateStage(entry);
                  const stageInfo = templateStageDisplay(stage);
                  const stageBusy = stageUpdatingKey === key;
                  const deleting = deletingKey === key;
                  const cloning = cloningKey === key;
                  const rowBusy = deleting || stageBusy || cloning || bulkBusy;
                  return (
                    <motion.tr
                      key={key}
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
                          checked={selected.has(key)}
                          onChange={() => toggleOne(key)}
                          className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                          aria-label={`Select ${name}`}
                        />
                      </td>
                      <td className="max-w-[280px] px-4 py-3 align-middle">
                        <Link
                          href={editHref(entry)}
                          className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                        {templateTypeLabel(entry)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge
                          variant="outline"
                          title={stageInfo.title}
                          className={cn("text-xs font-medium capitalize", stageInfo.badgeClass)}
                        >
                          {stageInfo.label}
                        </Badge>
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
                              aria-label={`Actions for ${name}`}
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
                              <Link href={editHref(entry)}>Edit</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={previewHref(entry)} target="_blank" rel="noopener noreferrer">
                                Preview
                              </Link>
                            </DropdownMenuItem>
                            {stage === "draft" ? (
                              <DropdownMenuItem
                                disabled={stageBusy}
                                onClick={() => void updateStage(entry, "published")}
                              >
                                Publish
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled={stageBusy} onClick={() => void updateStage(entry, "draft")}>
                                Mark as draft
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem disabled={cloning} onClick={() => void cloneEntry(entry)}>
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={deleting}
                              className="text-destructive focus:text-destructive"
                              onClick={() => void deleteEntry(entry)}
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
