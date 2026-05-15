"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Pencil, Search, Trash2, Copy } from "lucide-react";
import type { ContractTemplateRecord } from "@/types/contract-template";
import { deleteContractTemplateAction, cloneContractTemplateAction } from "@/server/actions/contract-templates";
import { formatLastEditedInLocality } from "@/lib/proposal-locality-dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ContractTemplatesListPanelProps {
  templates: ContractTemplateRecord[];
  localityTimeZone?: string;
}

function lastEditedMs(t: ContractTemplateRecord): number {
  return Math.max(t.updatedAt ?? 0, t.createdAt ?? 0);
}

export function ContractTemplatesListPanel({ templates, localityTimeZone }: ContractTemplatesListPanelProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [cloningId, setCloningId] = React.useState<string | null>(null);

  async function deleteRow(id: string, name: string) {
    if (!window.confirm(`Delete contract template “${name}”? Proposals that already copied its text are unchanged.`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await deleteContractTemplateAction(id);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function cloneRow(id: string) {
    setCloningId(id);
    try {
      const res = await cloneContractTemplateAction(id);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.push(`/admin/templates/contracts/${res.contractTemplateId}`);
      router.refresh();
    } finally {
      setCloningId(null);
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
      const hay = [t.name, t.description ?? "", t.agreementTitle].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [sorted, query]);

  return (
    <section
      id="contract-templates"
      className="scroll-mt-8 overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm backdrop-blur-sm"
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="shrink-0 text-sm font-semibold text-foreground">Contract templates</h2>
        <div className="relative min-w-0 flex-1 sm:max-w-xs md:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contracts…"
            className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
            aria-label="Search contract templates"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="min-w-[140px] px-4 py-2.5 font-medium">Modal title</th>
              <th className="min-w-[160px] px-4 py-2.5 font-medium">Last edited</th>
              <th className="min-w-[140px] px-2 py-2.5 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <p className="mx-auto max-w-md leading-relaxed">
                    No contract templates yet. Use{" "}
                    <span className="font-medium text-foreground">New contract template</span> to add reusable
                    agreements for Accept blocks.
                  </p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No templates match your search.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.map((t, index) => {
                  const edited = lastEditedMs(t);
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
                          href={`/admin/templates/contracts/${t.id}`}
                          className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {t.name}
                        </Link>
                        {t.description?.trim() ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.description.trim()}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-middle text-muted-foreground">{t.agreementTitle}</td>
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
                            className="h-8 w-8"
                            disabled={cloningId === t.id}
                            aria-label={`Clone “${t.name}”`}
                            title="Duplicate"
                            onClick={() => void cloneRow(t.id)}
                          >
                            {cloningId === t.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={deletingId === t.id}
                            aria-label={`Delete “${t.name}”`}
                            onClick={() => void deleteRow(t.id, t.name)}
                          >
                            {deletingId === t.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden />
                            )}
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                            <Link href={`/admin/templates/contracts/${t.id}`} aria-label={`Edit “${t.name}”`}>
                              <Pencil className="h-4 w-4" aria-hidden />
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
