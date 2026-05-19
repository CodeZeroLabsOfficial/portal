"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
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
import { deleteProposalTemplateAction, setProposalTemplateStageAction } from "@/server/actions/proposal-templates";
import { formatLastEditedInLocality } from "@/lib/proposal-locality-dates";
import { CloneProposalTemplateButton } from "@/components/proposal/clone-proposal-template-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listRowIconActionClassName } from "@/components/ui/list-row-icon-action";
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
  const [deletingKey, setDeletingKey] = React.useState<string | null>(null);
  const [stageUpdatingKey, setStageUpdatingKey] = React.useState<string | null>(null);
  const [cloningContractId, setCloningContractId] = React.useState<string | null>(null);

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

  async function cloneContract(id: string) {
    setCloningContractId(id);
    try {
      const res = await cloneContractTemplateAction(id);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.push(`/admin/templates/contracts/${res.contractTemplateId}`);
      router.refresh();
    } finally {
      setCloningContractId(null);
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
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Template name</th>
              <th className="min-w-[100px] px-4 py-2.5 font-medium">Type</th>
              <th className="min-w-[120px] px-4 py-2.5 font-medium">Stage</th>
              <th className="min-w-[180px] px-4 py-2.5 font-medium">Last edited date</th>
              <th className="min-w-[220px] px-2 py-2.5 text-center font-medium">Action buttons</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <p className="mx-auto max-w-md leading-relaxed">
                    No templates yet. Use <span className="font-medium text-foreground">New template</span> or{" "}
                    <span className="font-medium text-foreground">New contract template</span> to create reusable
                    content for proposals and agreements.
                  </p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No templates match your search.
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
                      <td className="px-2 py-3 align-middle">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              listRowIconActionClassName,
                              "hover:bg-destructive/10 hover:text-destructive",
                            )}
                            disabled={deleting || stageBusy}
                            aria-label={`Delete template “${name}”`}
                            onClick={() => void deleteEntry(entry)}
                          >
                            {deleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden />
                            )}
                          </Button>
                          {stage === "draft" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={listRowIconActionClassName}
                              disabled={stageBusy || deleting}
                              aria-label={`Publish template “${name}”`}
                              title="Publish"
                              onClick={() => void updateStage(entry, "published")}
                            >
                              {stageBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" aria-hidden />
                              )}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={listRowIconActionClassName}
                              disabled={stageBusy || deleting}
                              aria-label={`Mark template “${name}” as draft`}
                              title="Mark as draft"
                              onClick={() => void updateStage(entry, "draft")}
                            >
                              {stageBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <RotateCcw className="h-4 w-4" aria-hidden />
                              )}
                            </Button>
                          )}
                          {entry.kind === "proposal" ? (
                            <CloneProposalTemplateButton templateId={entry.row.id} iconOnly />
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={listRowIconActionClassName}
                              disabled={cloningContractId === entry.row.id || deleting || stageBusy}
                              aria-label={`Clone “${name}”`}
                              title="Duplicate"
                              onClick={() => void cloneContract(entry.row.id)}
                            >
                              {cloningContractId === entry.row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Copy className="h-4 w-4" aria-hidden />
                              )}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className={listRowIconActionClassName} asChild>
                            <Link href={editHref(entry)} aria-label={`Edit template “${name}”`}>
                              <Pencil className="h-4 w-4" aria-hidden />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className={listRowIconActionClassName} asChild>
                            <Link
                              href={previewHref(entry)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open public preview for template “${name}”`}
                            >
                              <ExternalLink className="h-4 w-4" aria-hidden />
                            </Link>
                          </Button>
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
