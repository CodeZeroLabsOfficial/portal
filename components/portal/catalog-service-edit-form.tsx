"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  activateCatalogServiceAction,
  archiveCatalogServiceAction,
  saveCatalogServiceAction,
  syncCatalogServiceStripeAction,
} from "@/server/actions/catalog-services";
import { slugifyCatalogServiceName } from "@/lib/catalog-service-slug";
import { formatCurrencyAmount } from "@/lib/format";
import type { CatalogServiceRecord } from "@/types/catalog-service";
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

const STATUS_BADGE: Record<CatalogServiceRecord["status"], string> = {
  draft: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  archived: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
};

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

  async function runAction(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setMessage(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setMessage(res.message ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function onSave() {
    const features = featuresText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    await runAction(() =>
      saveCatalogServiceAction({
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
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(STATUS_BADGE[service.status])}>
            {service.status}
          </Badge>
          {service.stripeProductId ? (
            <span className="font-mono text-xs text-muted-foreground">{service.stripeProductId}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {service.status !== "archived" ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onSave()}>
              Save
            </Button>
          ) : null}
          {service.status === "draft" ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void runAction(() => activateCatalogServiceAction(service.id))}
            >
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Activate & sync to Stripe
            </Button>
          ) : null}
          {service.status === "active" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void runAction(() => syncCatalogServiceStripeAction(service.id))}
            >
              Re-sync Stripe prices
            </Button>
          ) : null}
          {service.status !== "archived" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (!window.confirm("Archive this service? It will be hidden from new proposals.")) return;
                void runAction(() => archiveCatalogServiceAction(service.id));
              }}
            >
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="service-name">Name</Label>
            <Input
              id="service-name"
              value={name}
              disabled={service.status === "archived" || busy}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugifyCatalogServiceName(service.name)) {
                  setSlug(slugifyCatalogServiceName(e.target.value));
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service-slug">Slug (Stripe lookup keys)</Label>
            <Input
              id="service-slug"
              value={slug}
              disabled={service.status === "archived" || busy}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service-sort">Sort order</Label>
            <Input
              id="service-sort"
              type="number"
              min={0}
              value={sortOrder}
              disabled={service.status === "archived" || busy}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pricing ({service.currency.toUpperCase()} / month)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="m12">12-month term</Label>
            <Input
              id="m12"
              inputMode="decimal"
              placeholder="0.00"
              value={monthly12}
              disabled={service.status === "archived" || busy}
              onChange={(e) => setMonthly12(e.target.value)}
            />
            {service.terms.find((t) => t.months === 12)?.stripePriceId ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                {service.terms.find((t) => t.months === 12)?.stripePriceId}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m24">24-month term</Label>
            <Input
              id="m24"
              inputMode="decimal"
              placeholder="0.00"
              value={monthly24}
              disabled={service.status === "archived" || busy}
              onChange={(e) => setMonthly24(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upfront">Upfront (12-month only)</Label>
            <Input
              id="upfront"
              inputMode="decimal"
              placeholder="0.00"
              value={upfront12}
              disabled={service.status === "archived" || busy}
              onChange={(e) => setUpfront12(e.target.value)}
            />
          </div>
          {service.stripeSyncedAt ? (
            <p className="text-xs text-muted-foreground sm:col-span-3">
              Last synced{" "}
              {new Date(service.stripeSyncedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · "}
              Preview 12m: {formatCurrencyAmount(majorInputToMinor(monthly12), service.currency)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entitlements</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="users">Included users</Label>
            <Input
              id="users"
              type="number"
              min={0}
              value={includedUsers}
              disabled={service.status === "archived" || busy}
              onChange={(e) => setIncludedUsers(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="locations">Included locations</Label>
            <Input
              id="locations"
              type="number"
              min={0}
              value={includedLocations}
              disabled={service.status === "archived" || busy}
              onChange={(e) => setIncludedLocations(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admins">Included admins</Label>
            <Input
              id="admins"
              type="number"
              min={0}
              value={includedAdmins}
              disabled={service.status === "archived" || busy}
              onChange={(e) => setIncludedAdmins(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Features (one per line)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={featuresText}
            disabled={service.status === "archived" || busy}
            onChange={(e) => setFeaturesText(e.target.value)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
