"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleDot,
  Layers,
  Loader2,
  Package,
  Users,
} from "lucide-react";
import {
  archiveCatalogServiceAction,
  saveAndActivateCatalogServiceAction,
  saveAndSyncCatalogServiceStripeAction,
  saveCatalogServiceAction,
} from "@/server/actions/catalog-services";
import { formatCurrencyAmount } from "@/lib/format";
import type { CatalogServiceRecord, CatalogServiceStatus } from "@/types/catalog-service";
import { CatalogServiceStripeIntegrationsCard } from "@/components/portal/catalog-service-stripe-integrations-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function serviceTypeLabel(service: CatalogServiceRecord): string {
  if (service.serviceType === "plan") return "Plan";
  if (service.serviceType === "addon") return "Add-on";
  return "—";
}

function billingLabel(service: CatalogServiceRecord): string {
  if (service.billingType === "one_off") return "One-off";
  if (service.billingType === "recurring") return "Recurring";
  return "—";
}

function pricingModelLabel(service: CatalogServiceRecord): string {
  if (service.pricingModel === "flat") return "Flat rate";
  if (service.pricingModel === "by_term") return "Fixed term (12 / 24 mo)";
  return "—";
}

const fieldInputClass =
  "h-9 rounded-md border-border/80 bg-background/60 text-[14px] text-foreground";

const detailLabelClass =
  "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

export interface CatalogServiceEditFormProps {
  service: CatalogServiceRecord;
}

export function CatalogServiceEditForm({ service }: CatalogServiceEditFormProps) {
  const router = useRouter();
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [name, setName] = React.useState(service.name);
  const [includedUsers, setIncludedUsers] = React.useState(String(service.includedUsers));
  const [includedLocations, setIncludedLocations] = React.useState(String(service.includedLocations));
  const [includedAdmins, setIncludedAdmins] = React.useState(String(service.includedAdmins));
  const [monthly12, setMonthly12] = React.useState(minorToMajorInput(termMinor(service, 12)));
  const [monthly24, setMonthly24] = React.useState(minorToMajorInput(termMinor(service, 24)));
  const [upfront12, setUpfront12] = React.useState(minorToMajorInput(service.upfrontCost12Minor ?? 0));
  const [featuresText, setFeaturesText] = React.useState(service.features.join("\n"));

  const st = statusBadge(service.status);
  const readOnly = service.status === "archived" || busy;
  const isPlan = service.serviceType !== "addon";

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
      currency: service.currency,
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/admin/services">
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Services
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {service.status !== "archived" ? (
            <Button
              type="button"
              size="sm"
              className="min-w-[5.5rem] gap-2"
              disabled={readOnly || busy}
              onClick={() => void onSave()}
            >
              {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              Save
            </Button>
          ) : null}
          {service.status !== "archived" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
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
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/80 shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
              Service details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="service-name" className={detailLabelClass}>
                Name
              </Label>
              <Input
                id="service-name"
                value={name}
                disabled={readOnly}
                className={fieldInputClass}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className={detailLabelClass}>
                  <CircleDot className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Status
                </dt>
                <dd>
                  <Badge variant="outline" className={cn("font-normal", st.className)}>
                    {st.label}
                  </Badge>
                </dd>
              </div>
              <div className="space-y-1">
                <dt className={detailLabelClass}>
                  <Layers className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Type
                </dt>
                <dd>
                  {service.serviceType ? (
                    <Badge variant="outline" className="font-normal">
                      {serviceTypeLabel(service)}
                    </Badge>
                  ) : (
                    <span className="text-foreground">—</span>
                  )}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className={detailLabelClass}>Billing</dt>
                <dd className="text-foreground">{billingLabel(service)}</dd>
              </div>
              <div className="space-y-1">
                <dt className={detailLabelClass}>Pricing model</dt>
                <dd className="text-foreground">{pricingModelLabel(service)}</dd>
              </div>
            </dl>

            {service.description?.trim() ? (
              <div className="space-y-1 border-t border-border/60 pt-4">
                <p className={detailLabelClass}>Description</p>
                <p className="text-sm text-foreground">{service.description.trim()}</p>
              </div>
            ) : null}

            <div className="space-y-4 border-t border-border/60 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pricing ({service.currency.toUpperCase()} per month)
              </p>
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
                {isPlan ? (
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
                ) : null}
              </div>
              {majorInputToMinor(monthly12) > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Preview 12 mo: {formatCurrencyAmount(majorInputToMinor(monthly12), service.currency)}
                </p>
              ) : null}
            </div>

            {isPlan ? (
              <div className="space-y-4 border-t border-border/60 pt-4">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Entitlements
                </p>
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
              </div>
            ) : null}

            <div className="space-y-2 border-t border-border/60 pt-4">
              <Label htmlFor="features" className={detailLabelClass}>
                Features
              </Label>
              <textarea
                id="features"
                className="min-h-[120px] w-full rounded-md border border-border/80 bg-background/60 px-3 py-2 text-[14px] text-foreground"
                value={featuresText}
                disabled={readOnly}
                placeholder="One feature per line"
                onChange={(e) => setFeaturesText(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <CatalogServiceStripeIntegrationsCard
          service={service}
          busy={busy}
          readOnly={readOnly}
          onActivateSync={
            service.status === "draft"
              ? () => void runAction(() => saveAndActivateCatalogServiceAction(buildSavePayload()))
              : undefined
          }
          onResync={
            service.status === "active"
              ? () => void runAction(() => saveAndSyncCatalogServiceStripeAction(buildSavePayload()))
              : undefined
          }
        />
      </div>
    </div>
  );
}
