"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Plus, Search, SquareArrowOutUpRight } from "lucide-react";
import type { AccountListRow } from "@/lib/account-list";
import { websiteHref } from "@/lib/format";
import { AddAccountModal } from "@/components/portal/add-account-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";

export interface AccountListPanelProps {
  rows: AccountListRow[];
}

export function AccountListPanel({ rows }: AccountListPanelProps) {
  const router = useRouter();

  React.useEffect(() => {
    router.refresh();
  }, [router]);

  const [query, setQuery] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.displayName,
        row.addressSummary,
        row.companyPhone,
        row.companyEmail,
        row.companyWebsite,
        String(row.contactCount),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="space-y-8">
      <AddAccountModal open={addOpen} onOpenChange={setAddOpen} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Accounts</h1>
          <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>
            Company profiles from customer records. Set company details when editing a customer.
          </p>
        </motion.div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add account
        </Button>
      </div>

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
                placeholder="Search company, address, email, website…"
                className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
                aria-label="Search accounts"
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
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Address</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Website</th>
                <th className="px-4 py-2.5 font-medium">Contacts</th>
                <th className="w-14 px-2 py-2.5 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <p className="mx-auto max-w-md leading-relaxed">
                      No accounts yet. Add a <span className="font-medium text-foreground">Company</span> name on a
                      customer profile to see it listed here.
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No accounts match your search.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {filtered.map((row, index) => (
                    <motion.tr
                      key={row.key}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, delay: index * 0.012 }}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 align-middle">
                        <Link
                          href={`/admin/accounts/${row.key}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {row.displayName}
                        </Link>
                      </td>
                      <td className="max-w-[220px] px-4 py-3 align-middle text-muted-foreground">
                        <span className="line-clamp-2">{row.addressSummary}</span>
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 align-middle text-muted-foreground">
                        {row.companyPhone.trim() ? row.companyPhone : "—"}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 align-middle text-muted-foreground">
                        {row.companyEmail.trim() ? row.companyEmail : "—"}
                      </td>
                      <td className="max-w-[160px] px-4 py-3 align-middle">
                        {row.companyWebsite.trim() ? (
                          <a
                            href={websiteHref(row.companyWebsite)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-primary underline-offset-4 hover:underline"
                          >
                            {row.companyWebsite.trim()}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-muted-foreground">
                        <span className="tabular-nums">{row.contactCount}</span>
                        {row.activeContactCount !== row.contactCount ? (
                          <span className="ml-1 text-[11px] text-muted-foreground/80">
                            ({row.activeContactCount} active)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 text-center align-middle">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Actions for ${row.displayName}`}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="min-w-[10rem] border-border/80 bg-popover text-popover-foreground shadow-lg"
                          >
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/accounts/${row.key}`}>Open account</Link>
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
