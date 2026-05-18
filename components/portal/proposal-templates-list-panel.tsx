"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import type {
  ProposalTemplateRecord,
  ProposalTemplateStage,
  ProposalTemplateType,
} from "@/types/proposal-template";
import { deleteProposalTemplateAction, setProposalTemplateStageAction } from "@/server/actions/proposal-templates";
import { formatLastEditedInLocality } from "@/lib/proposal-locality-dates";
import { CloneProposalTemplateButton } from "@/components/proposal/clone-proposal-template-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ProposalTemplatesListPanelProps {
  templates: ProposalTemplateRecord[];
  localityTimeZone?: string;
}

function lastEditedMs(t: ProposalTemplateRecord): number {
  return (typeof t.updatedAt === "number" && t.updatedAt > 0 ? t.updatedAt : t.createdAt) || 0;
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

export function ProposalTemplatesListPanel({ templates, localityTimeZone }: ProposalTemplatesListPanelProps) {
  const router = useRouter();

  React.useEffect(() => {
    router.refresh();
  }, [router]);

  const [query, setQuery] = React.useState("");
  const [deletingTemplateId, setDeletingTemplateId] = React.useState<string | null>(null);
  const [stageUpdatingId, setStageUpdatingId] = React.useState<string | null>(null);

  async function deleteTemplate(templateId: string, name: string) {
    if (!window.confirm(`Delete template “${name}”? This cannot be undone.`)) return;
    setDeletingTemplateId(templateId);
    try {
      const res = await deleteProposalTemplateAction(templateId);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.refresh();
    } finally {
      setDeletingTemplateId(null);
    }
  }

  async function updateStage(templateId: string, stage: ProposalTemplateStage) {
    setStageUpdatingId(templateId);
    try {
      const res = await setProposalTemplateStageAction(templateId, stage);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.refresh();
    } finally {
      setStageUpdatingId(null);
    }
  }

  const sorted = React.useMemo(
    () => [...templates].sort((a, b) => lastEditedMs(b) - lastEditedMs(a)),
    [templates],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => {
      const desc = (t.description ?? "").trim();
      const stageLabel = templateStageDisplay(t.stage).label;
      const typeLabel = proposalTemplateTypeLabel(t.templateType);
      const hay = [t.name, desc, typeLabel, stageLabel, formatLastEditedInLocality(lastEditedMs(t), localityTimeZone)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sorted, query, localityTimeZone]);

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
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <p className="mx-auto max-w-md leading-relaxed">
                      No templates yet. Use <span className="font-medium text-foreground">New template</span> to create
                      one for proposals from the CRM.
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
                  {filtered.map((t, index) => {
                    const edited = lastEditedMs(t);
                    const stageInfo = templateStageDisplay(t.stage);
                    const stageBusy = stageUpdatingId === t.id;
                    return (
                      <motion.tr
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, delay: index * 0.012 }}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="max-w-[280px] px-4 py-3 align-middle">
                          <Link
                            href={`/admin/templates/${t.id}`}
                            className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {t.name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                          {proposalTemplateTypeLabel(t.templateType)}
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
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={deletingTemplateId === t.id || stageBusy}
                              aria-label={`Delete template “${t.name}”`}
                              onClick={() => void deleteTemplate(t.id, t.name)}
                            >
                              {deletingTemplateId === t.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Trash2 className="h-4 w-4" aria-hidden />
                              )}
                            </Button>
                            {t.stage === "draft" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={stageBusy || deletingTemplateId === t.id}
                                aria-label={`Publish template “${t.name}”`}
                                title="Publish"
                                onClick={() => void updateStage(t.id, "published")}
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
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={stageBusy || deletingTemplateId === t.id}
                                aria-label={`Mark template “${t.name}” as draft`}
                                title="Mark as draft"
                                onClick={() => void updateStage(t.id, "draft")}
                              >
                                {stageBusy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                  <RotateCcw className="h-4 w-4" aria-hidden />
                                )}
                              </Button>
                            )}
                            <CloneProposalTemplateButton templateId={t.id} iconOnly />
                            <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                              <Link
                                href={`/admin/templates/${t.id}`}
                                aria-label={`Edit template “${t.name}”`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </Link>
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                              <Link
                                href={`/admin/templates/${t.id}/preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open public preview for template “${t.name}”`}
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
