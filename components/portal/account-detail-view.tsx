import Link from "next/link";
import { ArrowLeft, Building2, Globe, Mail, MapPin, Phone, Users } from "lucide-react";
import type { AccountDetailAggregate } from "@/server/firestore/crm-customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function websiteHref(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function formatMultilineAddress(account: AccountDetailAggregate): string[] {
  const lines: string[] = [];
  if (account.companyAddressLine1?.trim()) lines.push(account.companyAddressLine1.trim());
  if (account.companyAddressLine2?.trim()) lines.push(account.companyAddressLine2.trim());
  const locality = [
    [account.companyCity, account.companyRegion].filter(Boolean).join(", "),
    account.companyPostalCode,
  ]
    .filter(Boolean)
    .join(" ");
  const tail = [locality, account.companyCountry?.trim()].filter(Boolean).join(", ");
  if (tail) lines.push(tail);
  return lines;
}

export interface AccountDetailViewProps {
  account: AccountDetailAggregate;
}

export function AccountDetailView({ account }: AccountDetailViewProps) {
  const addressLines = formatMultilineAddress(account);
  const hasAddress = addressLines.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/accounts">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Accounts
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25"
            aria-hidden
          >
            <Building2 className="h-7 w-7 stroke-[1.5]" />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem] md:leading-tight">
              {account.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {account.contacts.length} contact{account.contacts.length === 1 ? "" : "s"} linked to this company name
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/80 shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="text-lg">Company details</CardTitle>
            <CardDescription>Stored on customer profiles; newest non-empty value is shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Company phone
                </dt>
                <dd className="text-sm text-foreground">
                  {account.companyPhone.trim() ? (
                    <a className="text-primary hover:underline" href={`tel:${account.companyPhone.trim()}`}>
                      {account.companyPhone.trim()}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  Company email
                </dt>
                <dd className="text-sm text-foreground">
                  {account.companyEmail.trim() ? (
                    <a
                      className="text-primary hover:underline"
                      href={`mailto:${account.companyEmail.trim()}`}
                    >
                      {account.companyEmail.trim()}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" aria-hidden />
                  Website
                </dt>
                <dd className="text-sm text-foreground">
                  {account.companyWebsite.trim() ? (
                    <a
                      href={websiteHref(account.companyWebsite)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {account.companyWebsite.trim()}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Company address
                </dt>
                <dd className="text-sm leading-relaxed text-foreground">
                  {hasAddress ? (
                    <span className="whitespace-pre-line">{addressLines.join("\n")}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
              Contacts
            </CardTitle>
            <CardDescription>People with this company on their profile.</CardDescription>
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
