import Link from "next/link";
import { Calendar, Globe, Mail, MapPin, Pencil, Phone, Shield, User } from "lucide-react";
import type { PortalUser } from "@/types/user";
import { roleLabel } from "@/lib/auth/role-label";
import { formatAddressLines, websiteHref } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WORKSPACE_DETAIL_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS,
} from "@/lib/workspace-page-typography";

function profileHeadingName(user: PortalUser): string {
  const fn = user.firstName?.trim();
  const ln = user.lastName?.trim();
  if (fn || ln) {
    return [fn, ln].filter(Boolean).join(" ");
  }
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }
  return user.email || "Profile";
}

function formatDob(iso: string | undefined): string {
  const s = iso?.trim();
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export interface UserProfileViewProps {
  user: PortalUser;
}

export function UserProfileView({ user }: UserProfileViewProps) {
  const addressLines = formatAddressLines(user);
  const hasAddress = addressLines.length > 0;
  const heading = profileHeadingName(user);
  const dobLabel = formatDob(user.dateOfBirth);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25"
            aria-hidden
          >
            <User className="h-7 w-7 stroke-[1.5]" />
          </span>
          <div className="min-w-0 space-y-2">
            <h1 className={WORKSPACE_DETAIL_PAGE_TITLE_CLASS}>{heading}</h1>
            <p className={WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS}>{user.email}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5 shadow-sm" asChild>
          <Link href="/admin/settings/profile/edit">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </Link>
        </Button>
      </div>

      <Card className="border-border/80 bg-card/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle className="text-lg">Profile details</CardTitle>
          <CardDescription>Information stored on your workspace user record.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">First name</dt>
              <dd className="text-sm text-foreground">
                {user.firstName?.trim() ? user.firstName.trim() : <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last name</dt>
              <dd className="text-sm text-foreground">
                {user.lastName?.trim() ? user.lastName.trim() : <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Email
              </dt>
              <dd className="text-sm text-foreground">
                {user.email ? (
                  <a className="text-primary hover:underline" href={`mailto:${user.email}`}>
                    {user.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Role
              </dt>
              <dd className="text-sm text-foreground">{roleLabel(user.role)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                Phone
              </dt>
              <dd className="text-sm text-foreground">
                {user.phone?.trim() ? (
                  <a className="text-primary hover:underline" href={`tel:${user.phone.trim()}`}>
                    {user.phone.trim()}
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
                {user.website?.trim() ? (
                  <a
                    href={websiteHref(user.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {user.website.trim()}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                Date of birth
              </dt>
              <dd className="text-sm text-foreground">
                {dobLabel ? dobLabel : <span className="text-muted-foreground">—</span>}
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
