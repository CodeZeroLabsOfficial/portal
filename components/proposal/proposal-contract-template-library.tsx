"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, FileText, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  PROPOSAL_EDITOR_LIBRARY_ASIDE_CLASS,
  PROPOSAL_EDITOR_LIBRARY_BACKDROP_CLASS,
} from "@/components/proposal/proposal-editor-library-scope";

const noop = () => {};

export type ContractTemplatePick = {
  id: string;
  name: string;
  agreementTitle: string;
  introHtml: string;
  legalHtml: string;
};

export type ProposalContractTemplateLibraryOpenParams = {
  onSelect: (pick: ContractTemplatePick) => void;
};

type ApiRow = {
  id: string;
  name: string;
  agreementTitle: string;
  introHtml: string;
  legalHtml: string;
  previewSnippet: string;
};

type ProposalContractTemplateLibraryContextValue = {
  isOpen: boolean;
  activeParams: ProposalContractTemplateLibraryOpenParams | null;
  openSelection: (params: ProposalContractTemplateLibraryOpenParams) => void;
  close: () => void;
};

const ProposalContractTemplateLibraryContext =
  React.createContext<ProposalContractTemplateLibraryContextValue | null>(null);

export function useProposalContractTemplateLibraryOptional(): ProposalContractTemplateLibraryContextValue | null {
  return React.useContext(ProposalContractTemplateLibraryContext);
}

function ContractTemplateLibrarySidebar() {
  const ctx = React.useContext(ProposalContractTemplateLibraryContext);
  const isOpen = Boolean(ctx?.isOpen && ctx.activeParams);
  const activeParams = ctx?.activeParams ?? null;
  const close = ctx?.close ?? noop;

  const [query, setQuery] = React.useState("");
  const [rows, setRows] = React.useState<ApiRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const prevOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !prevOpen.current) {
      setQuery("");
    }
    prevOpen.current = isOpen;
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/contract-templates")
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json() as Promise<{ templates?: ApiRow[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setRows(Array.isArray(data.templates) ? data.templates : []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load contract templates");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) => {
      const hay = [t.name, t.agreementTitle, t.previewSnippet].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <AnimatePresence>
      {isOpen && activeParams ? (
        <>
          <motion.button
            type="button"
            aria-label="Close contract library"
            className={PROPOSAL_EDITOR_LIBRARY_BACKDROP_CLASS}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => close()}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="proposal-contract-template-library-title"
            className={PROPOSAL_EDITOR_LIBRARY_ASIDE_CLASS}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <button
              type="button"
              className="absolute -right-3 top-1/2 z-[1] flex h-14 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border bg-background text-muted-foreground shadow-md transition-colors hover:bg-muted"
              aria-label="Close contract library"
              onClick={() => close()}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-5">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h2 id="proposal-contract-template-library-title" className="text-sm font-semibold leading-tight text-foreground">
                  Contract templates
                </h2>
              </div>
              <p className="mb-4 text-xs leading-snug text-muted-foreground">
                Choose a saved agreement. Text is copied onto this Accept block so proposals stay stable when templates
                change later.
              </p>

              <div className="relative mb-3">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search contracts…"
                  className="h-10 rounded-lg border-border bg-muted/40 pl-9 text-sm"
                  aria-label="Search contract templates"
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 pb-3">
                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
                    <p className="text-sm">Loading…</p>
                  </div>
                ) : error ? (
                  <div className="space-y-3 py-10 text-center">
                    <p className="text-sm text-destructive">{error}</p>
                    <button
                      type="button"
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => {
                        setError(null);
                        setLoading(true);
                        void fetch("/api/contract-templates")
                          .then(async (res) => {
                            if (!res.ok) throw new Error(res.statusText);
                            return res.json() as Promise<{ templates?: ApiRow[] }>;
                          })
                          .then((data) => {
                            setRows(Array.isArray(data.templates) ? data.templates : []);
                            setLoading(false);
                          })
                          .catch(() => {
                            setError("Could not load contract templates");
                            setLoading(false);
                          });
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : visible.length === 0 ? (
                  <div className="space-y-2 py-12 text-center text-sm text-muted-foreground">
                    <p>No contract templates yet.</p>
                    <p className="text-xs leading-relaxed">
                      Add reusable agreements under{" "}
                      <Link href="/admin/templates" className="font-medium text-primary underline-offset-2 hover:underline">
                        Templates
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 pb-2 sm:grid-cols-2">
                    {visible.map((t) => (
                      <li key={t.id} className="sm:col-span-2">
                        <button
                          type="button"
                          className="group relative w-full overflow-hidden rounded-xl border border-border bg-muted/15 text-left ring-offset-background transition-all hover:border-primary/50 hover:bg-muted/25 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={() => {
                            activeParams.onSelect({
                              id: t.id,
                              name: t.name,
                              agreementTitle: t.agreementTitle,
                              introHtml: t.introHtml ?? "",
                              legalHtml: t.legalHtml ?? "",
                            });
                            close();
                          }}
                        >
                          <span className="flex aspect-[16/10] w-full flex-col justify-between gap-2 bg-gradient-to-b from-cyan-950/25 to-neutral-950/90 px-3 py-3">
                            <FileText className="h-7 w-7 shrink-0 text-cyan-200/90" aria-hidden />
                            <span className="line-clamp-2 text-[12px] font-semibold leading-snug text-white/95">
                              {t.name}
                            </span>
                          </span>
                          <span className="block space-y-0.5 border-t border-border/80 bg-background/95 px-2.5 py-2">
                            <span className="line-clamp-1 text-[11px] font-medium text-foreground">{t.agreementTitle}</span>
                            {t.previewSnippet ? (
                              <span className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                                {t.previewSnippet}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">No legal HTML — buyer sees standard sections.</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="shrink-0 border-t border-border pt-3">
                <Link
                  href="/admin/templates"
                  className="flex w-full items-center justify-center rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => close()}
                >
                  Manage contract templates
                </Link>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function ProposalContractTemplateLibraryProvider({ children }: { children: React.ReactNode }) {
  const [activeParams, setActiveParams] = React.useState<ProposalContractTemplateLibraryOpenParams | null>(null);

  const openSelection = React.useCallback((params: ProposalContractTemplateLibraryOpenParams) => {
    setActiveParams(params);
  }, []);

  const close = React.useCallback(() => setActiveParams(null), []);

  const value = React.useMemo<ProposalContractTemplateLibraryContextValue>(
    () => ({
      isOpen: activeParams !== null,
      activeParams,
      openSelection,
      close,
    }),
    [activeParams, openSelection, close],
  );

  return (
    <ProposalContractTemplateLibraryContext.Provider value={value}>
      {children}
      <ContractTemplateLibrarySidebar />
    </ProposalContractTemplateLibraryContext.Provider>
  );
}
