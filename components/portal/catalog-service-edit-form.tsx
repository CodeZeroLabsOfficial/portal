"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import {
  archiveCatalogServiceAction,
  saveAndActivateCatalogServiceAction,
  saveAndSyncCatalogServiceStripeAction,
  saveCatalogServiceAction,
} from "@/server/actions/catalog-services";
import { slugifyCatalogServiceName } from "@/lib/catalog-service-slug";
import { formatCurrencyAmount } from "@/lib/format";
import type { CatalogServiceRecord, CatalogServiceStatus } from "@/types/catalog-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";

function termMinor(service: CatalogServiceRecord, months: 12 | 24): number {
  return service.terms.find((t) => t.months === months)?.monthlyAmountMinor ?? 0;
}

function minorToMajorInput(minor: number): string {
  if (!Number.isFinite(minor) || minor <= 0) return "";
  return (minor / 100).toFixed(2);
}

function majorInputToMinor(raw: string): number {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function statusBadge(status: CatalogServiceStatus): { label: string; className: string } {
  if (status === "active") {
    return {
      label: "Active",
      className: "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    };
  }
  if (status === "draft") {
    return {
      label: "Draft",
      className: "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300",
    };
  }
  return {
    label: "Archived",
    className: "border-border bg-muted/50 text-muted-foreground",
  };
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const fieldInputClass =
  "h-9 rounded-md border-border/80 bg-background/60 text-[14px] text-foreground";

export interface CatalogServiceEditFormProps {
  service: CatalogServiceRecord;
}

export function CatalogServiceEditForm({ service }: CatalogServiceEditFormProps) {
  const router = useRouter();
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [name, setName] = React.useState(service.name);
  const [slug, setSlug] = React.useState(service.slug);
  const [sortOrder, setSortOrder] = React.useState(String(service.sortOrder));
  const [includedUsers, setIncludedUsers] = React.useState(String(service.includedUsers));
  const [includedLocations, setIncludedLocations] = React.useState(String(service.includedLocations));
  const [includedAdmins, setIncludedAdmins] = React.useState(String(service.includedAdmins));
  const [monthly12, setMonthly12] = React.useState(minorToMajorInput(termMinor(service, 12)));
  const [monthly24, setMonthly24] = React.useState(minorToMajorInput(termMinor(service, 24)));
  const [upfront12, setUpfront12] = React.useState(minorToMajorInput(service.upfrontCost12Minor ?? 0));
  const [featuresText, setFeaturesText] = React.useState(service.features.join("\n"));

  const st = statusBadge(service.status);
  const readOnly = service.status === "archived" || busy;

  async function runAction(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    opts?: { redirectToList?: boolean },
  ) {
    setBusy(true);
    setMessage(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setMessage(res.message ?? "Something went wrong.");
      return;
    }
    if (opts?.redirectToList) {
      router.push("/admin/services");
      router.refresh();
      return;
    }
    router.refresh();
  }

  function buildSavePayload() {
    const features = featuresText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return {
      serviceId: service.id,
      name: name.trim(),
      slug: slug.trim() || slugifyCatalogServiceName(name),
      currency: service.currency,
      sortOrder: Number(sortOrder) || 0,
      includedUsers: Number(includedUsers) || 0,
      includedLocations: Number(includedLocations) || 0,
      includedAdmins: Number(includedAdmins) || 0,
      monthlyCost12Minor: majorInputToMinor(monthly12),
      monthlyCost24Minor: majorInputToMinor(monthly24),
      upfrontCost12Minor: majorInputToMinor(upfront12) || undefined,
      features,
    };
  }

  async function onSave() {
    await runAction(() => saveCatalogServiceAction(buildSavePayload()));
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <Link
            href="/admin/services"
            className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            Services
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>{name.trim() || service.name}</h1>
            <Badge variant="outline" className={cn("font-normal", st.className)}>
              {st.label}
            </Badge>
          </div>
          <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>
            {service.stripeProductId ? (
              <span className="font-mono text-[12px]">{service.stripeProductId}</span>
            ) : (
              "Not synced to Stripe yet"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {service.status !== "archived" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[14px] font-medium text-muted-foreground hover:text-foreground"
              disabled={readOnly}
              onClick={() => void onSave()}
            >
              Save
            </Button>
          ) : null}
          {service.status === "draft" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
              disabled={busy}
              onClick={() => void runAction(() => saveAndActivateCatalogServiceAction(buildSavePayload()))}
            >
              {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              Activate & sync
            </Button>
          ) : null}
          {service.status === "active" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[14px] font-medium text-muted-foreground hover:text-foreground"
              disabled={busy}
              onClick={() => void runAction(() => saveAndSyncCatalogServiceStripeAction(buildSavePayload()))}
            >
              Re-sync Stripe
            </Button>
          ) : null}
          {service.stripeProductId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[14px] font-medium text-muted-foreground hover:text-foreground"
              onClick={() =>
                window.open(`https://dashboard.stripe.com/products/${service.stripeProductId}`, "_blank")
              }
            >
              Open in Stripe
            </Button>
          ) : null}
          {service.status !== "archived" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[14px] font-medium text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Archive this service? It will be hidden from new proposals and subscriptions.",
                  )
                ) {
                  return;
                }
                void runAction(() => archiveCatalogServiceAction(service.id), { redirectToList: true });
              }}
            >
              Archive
            </Button>
          ) : null}
        </div>
      </motion.div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <FormSection title="Service details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="service-name" className="text-[13px] text-muted-foreground">
              Name
            </Label>
            <Input
              id="service-name"
              value={name}
              disabled={readOnly}
              className={fieldInputClass}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugifyCatalogServiceName(service.name)) {
                  setSlug(slugifyCatalogServiceName(e.target.value));
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service-slug" className="text-[13px] text-muted-foreground">
              Slug (Stripe lookup keys)
            </Label>
            <Input
              id="service-slug"
              value={slug}
              disabled={readOnly}
              className={cn(fieldInputClass, "font-mono")}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service-sort" className="text-[13px] text-muted-foreground">
              Sort order
            </Label>
            <Input
              id="service-sort"
              type="number"
              min={0}
              value={sortOrder}
              disabled={readOnly}
              className={fieldInputClass}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title={`Pricing (${service.currency.toUpperCase()} per month)`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="m12" className="text-[13px] text-muted-foreground">
              12-month term
            </Label>
            <Input
              id="m12"
              inputMode="decimal"
              placeholder="0.00"
              value={monthly12}
              disabled={readOnly}
              className={fieldInputClass}
              onChange={(e) => setMonthly12(e.target.value)}
            />
            {service.terms.find((t) => t.months === 12)?.stripePriceId ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                {service.terms.find((t) => t.months === 12)?.stripePriceId}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m24" className="text-[13px] text-muted-foreground">
              24-month term
            </Label>
            <Input
              id="m24"
              inputMode="decimal"
              placeholder="0.00"
              value={monthly24}
              disabled={readOnly}
              className={fieldInputClass}
              onChange={(e) => setMonthly24(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upfront" className="text-[13px] text-muted-foreground">
              Upfront (12-month only)
            </Label>
            <Input
              id="upfront"
              inputMode="decimal"
              placeholder="0.00"
              value={upfront12}
              disabled={readOnly}
              className={fieldInputClass}
              onChange={(e) => setUpfront12(e.target.value)}
            />
          </div>
          {service.stripeSyncedAt ? (
            <p className="text-[13px] text-muted-foreground sm:col-span-3">
              Last synced{" "}
              {new Date(service.stripeSyncedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · "}
              Preview 12 mo: {formatCurrencyAmount(majorInputToMinor(monthly12), service.currency)}
            </p>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Entitlements">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="users" className="text-[13px] text-muted-foreground">
              Included users
            </Label>
            <Input
              id="users"
              type="number"
              min={0}
              value={includedUsers}
              disabled={readOnly}
              className={fieldInputClass}
              onChange={(e) => setIncludedUsers(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="locations" className="text-[13px] text-muted-foreground">
              Included locations
            </Label>
            <Input
              id="locations"
              type="number"
              min={0}
              value={includedLocations}
              disabled={readOnly}
              className={fieldInputClass}
              onChange={(e) => setIncludedLocations(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admins" className="text-[13px] text-muted-foreground">
              Included admins
            </Label>
            <Input
              id="admins"
              type="number"
              min={0}
              value={includedAdmins}
              disabled={readOnly}
              className={fieldInputClass}
              onChange={(e) => setIncludedAdmins(e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Features">
        <textarea
          className="min-h-[120px] w-full rounded-md border border-border/80 bg-background/60 px-3 py-2 text-[14px] text-foreground"
          value={featuresText}
          disabled={readOnly}
          placeholder="One feature per line"
          onChange={(e) => setFeaturesText(e.target.value)}
        />
      </FormSection>
    </div>
  );
}
