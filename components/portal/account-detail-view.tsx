import Link from "next/link";
import { ArrowLeft, Building2, Pencil, Users } from "lucide-react";
import type { AccountDetailAggregate } from "@/server/firestore/crm-customers";
import { AccountCompanyDetailsCard } from "@/components/portal/account-company-details-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WORKSPACE_DETAIL_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS,
} from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";

export interface AccountDetailViewProps {
  account: AccountDetailAggregate;
}

export function AccountDetailView({ account }: AccountDetailViewProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/accounts">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Accounts
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5 shadow-sm" asChild>
            <Link href={`/admin/accounts/${account.key}/edit`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25"
            aria-hidden
          >
            <Building2 className="h-7 w-7 stroke-[1.5]" />
          </span>
          <div className="min-w-0 space-y-2">
            <h1 className={WORKSPACE_DETAIL_PAGE_TITLE_CLASS}>{account.displayName}</h1>
            <div className={cn(WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS, "flex flex-wrap items-center gap-2")}>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                Active
              </Badge>
              {account.contacts.length === 1 ? (
                <Link href={`/admin/customers/${account.contacts[0]!.id}`} className="inline-flex">
                  <Badge
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80 hover:text-foreground"
                  >
                    1 contact
                  </Badge>
                </Link>
              ) : (
                <Badge variant="secondary">
                  {account.contacts.length} contact{account.contacts.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AccountCompanyDetailsCard account={account} accountKey={account.key} />

        <Card className="border-border/80 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {account.contacts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="font-medium text-foreground">{c.name.trim() || c.email}</span>
                    <span className="truncate text-xs text-muted-foreground">{c.email}</span>
                    <span
                      className={cn(
                        "mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                        c.status === "archived"
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-500/15 text-emerald-400",
                      )}
                    >
                      {c.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
