import Link from "next/link";
import { Building2, FileText, Globe, Mail, MapPin, Pencil, Phone } from "lucide-react";
import type { WorkspaceCompanySettings } from "@/types/organization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WORKSPACE_DETAIL_PAGE_TITLE_CLASS } from "@/lib/workspace-page-typography";

function websiteHref(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function formatCompanyAddressLines(s: WorkspaceCompanySettings): string[] {
  const lines: string[] = [];
  if (s.addressLine1.trim()) lines.push(s.addressLine1.trim());
  if (s.addressLine2.trim()) lines.push(s.addressLine2.trim());
  const locality = [[s.city, s.region].filter(Boolean).join(", "), s.postalCode].filter(Boolean).join(" ");
  const tail = [locality, s.country.trim()].filter(Boolean).join(", ");
  if (tail) lines.push(tail);
  return lines;
}

function headingTitle(s: WorkspaceCompanySettings): string {
  const n = s.name.trim();
  return n || "Company";
}

export interface CompanySettingsViewProps {
  settings: WorkspaceCompanySettings;
}

export function CompanySettingsView({ settings }: CompanySettingsViewProps) {
  const addressLines = formatCompanyAddressLines(settings);
  const hasAddress = addressLines.length > 0;
  const title = headingTitle(settings);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25"
            aria-hidden
          >
            <Building2 className="h-7 w-7 stroke-[1.5]" />
          </span>
          <div className="min-w-0 space-y-2">
            <h1 className={WORKSPACE_DETAIL_PAGE_TITLE_CLASS}>{title}</h1>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5 shadow-sm" asChild>
          <Link href="/admin/settings/company/edit">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </Link>
        </Button>
      </div>

      <Card className="border-border/80 bg-card/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle className="text-lg">Company details</CardTitle>
          <CardDescription>Legal entity and contact information for your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company name</dt>
              <dd className="text-sm text-foreground">
                {settings.name.trim() ? settings.name.trim() : <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                Phone
              </dt>
              <dd className="text-sm text-foreground">
                {settings.phone.trim() ? (
                  <a className="text-primary hover:underline" href={`tel:${settings.phone.trim()}`}>
                    {settings.phone.trim()}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Email
              </dt>
              <dd className="text-sm text-foreground">
                {settings.email.trim() ? (
                  <a className="text-primary hover:underline" href={`mailto:${settings.email.trim()}`}>
                    {settings.email.trim()}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Globe className="h-3.5 w-3.5" aria-hidden />
                Website
              </dt>
              <dd className="text-sm text-foreground">
                {settings.website.trim() ? (
                  <a
                    href={websiteHref(settings.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {settings.website.trim()}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                ACN
              </dt>
              <dd className="text-sm text-foreground">
                {settings.acn.trim() ? settings.acn.trim() : <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                ABN
              </dt>
              <dd className="text-sm text-foreground">
                {settings.abn.trim() ? settings.abn.trim() : <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Address
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
    </div>
  );
}
