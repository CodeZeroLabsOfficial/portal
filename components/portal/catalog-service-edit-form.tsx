"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  ArrowLeft,
  Calculator,
  CircleDot,
  CreditCard,
  DollarSign,
  Layers,
  Loader2,
  Package,
  Pencil,
  Tag,
  Users,
  X,
} from "lucide-react";
import {
  archiveCatalogServiceAction,
  saveAndActivateCatalogServiceAction,
  saveAndSyncCatalogServiceStripeAction,
  saveCatalogServiceAction,
} from "@/server/actions/catalog-services";
import type { CatalogServiceRecord, CatalogServiceStatus } from "@/types/catalog-service";
import { CatalogServiceStripeIntegrationsCard } from "@/components/portal/catalog-service-stripe-integrations-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrencyAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

function termMinor(service: CatalogServiceRecord, months: 12 | 24): number {
  return service.terms.find((t) => t.months === months)?.monthlyAmountMinor ?? 0;
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

function pricingDetailLabel(service: CatalogServiceRecord): React.ReactNode {
  const terms = service.terms;
  if (terms.length === 0) return "—";

  const currency = service.currency;
  const isByTerm = service.pricingModel === "by_term";
  const term12 = terms.find((t) => t.months === 12);
  const term24 = terms.find((t) => t.months === 24);

  if (isByTerm && (term12 || term24)) {
    const lines: string[] = [];
    if (term12 && term12.monthlyAmountMinor > 0) {
      lines.push(`12 mo · ${formatCurrencyAmount(term12.monthlyAmountMinor, currency)}/mo`);
    }
    if (term24 && term24.monthlyAmountMinor > 0) {
      lines.push(`24 mo · ${formatCurrencyAmount(term24.monthlyAmountMinor, currency)}/mo`);
    }
    if (lines.length === 0) return "—";
    if (lines.length === 1) return lines[0];
    return (
      <span className="flex flex-col gap-0.5">
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    );
  }

  const amount = terms[0]?.monthlyAmountMinor ?? 0;
  if (amount <= 0) return "—";
  const formatted = formatCurrencyAmount(amount, currency);
  if (service.billingType === "one_off") return formatted;
  return `${formatted}/mo`;
}

const fieldInputClass =
  "h-9 rounded-md border-border/80 bg-background/60 text-[14px] text-foreground";

const detailLabelClass =
  "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

const detailLabelIconClass = "h-3.5 w-3.5 shrink-0 opacity-80";

const descriptionTextareaClass =
  "min-h-[5rem] w-full resize-y rounded-md border border-border/80 bg-background/60 px-3 py-2 text-[14px] text-foreground";

function formValuesFromService(service: CatalogServiceRecord) {
  return {
    name: service.name,
    description: service.description ?? "",
    includedUsers: String(service.includedUsers),
    includedLocations: String(service.includedLocations),
    includedAdmins: String(service.includedAdmins),
  };
}

export interface CatalogServiceEditFormProps {
  service: CatalogServiceRecord;
}

export function CatalogServiceEditForm({ service }: CatalogServiceEditFormProps) {
  const router = useRouter();
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [isEditingDetails, setIsEditingDetails] = React.useState(false);

  const initial = formValuesFromService(service);
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description);
  const [includedUsers, setIncludedUsers] = React.useState(initial.includedUsers);
  const [includedLocations, setIncludedLocations] = React.useState(initial.includedLocations);
  const [includedAdmins, setIncludedAdmins] = React.useState(initial.includedAdmins);

  const st = statusBadge(service.status);
  const readOnly = service.status === "archived" || busy;
  const isPlan = service.serviceType !== "addon";
  const canEditDetails = service.status !== "archived" && !busy;

  function resetFormFromService(next: CatalogServiceRecord) {
    const values = formValuesFromService(next);
    setName(values.name);
    setDescription(values.description);
    setIncludedUsers(values.includedUsers);
    setIncludedLocations(values.includedLocations);
    setIncludedAdmins(values.includedAdmins);
  }

  function cancelEditingDetails() {
    resetFormFromService(service);
    setIsEditingDetails(false);
    setMessage(null);
  }

  React.useEffect(() => {
    if (!isEditingDetails) {
      resetFormFromService(service);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when server data changes while not editing
  }, [service.id, service.updatedAt, service.name, service.description, isEditingDetails]);

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
    return {
      serviceId: service.id,
      name: name.trim(),
      description: description.trim() || undefined,
      currency: service.currency,
      includedUsers: Number(includedUsers) || 0,
      includedLocations: Number(includedLocations) || 0,
      includedAdmins: Number(includedAdmins) || 0,
      monthlyCost12Minor: termMinor(service, 12),
      monthlyCost24Minor: termMinor(service, 24),
      ...(typeof service.upfrontCost12Minor === "number"
        ? { upfrontCost12Minor: service.upfrontCost12Minor }
        : {}),
      features: service.features,
    };
  }

  async function onSave() {
    await runAction(async () => {
      const res = await saveCatalogServiceAction(buildSavePayload());
      if (res.ok) {
        setIsEditingDetails(false);
      }
      return res;
    });
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
          {service.status !== "archived" ? (
            <Button
              type="button"
              size="sm"
              className="min-w-[5.5rem] gap-2"
              disabled={readOnly || busy || !isEditingDetails}
              onClick={() => void onSave()}
            >
              {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              Save
            </Button>
          ) : null}
        </div>
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/80 shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
                Service details
              </CardTitle>
              {canEditDetails ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={isEditingDetails ? "Cancel editing" : "Edit service details"}
                  onClick={() => {
                    if (isEditingDetails) {
                      cancelEditingDetails();
                      return;
                    }
                    resetFormFromService(service);
                    setIsEditingDetails(true);
                  }}
                >
                  {isEditingDetails ? (
                    <X className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6 text-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <dt className={detailLabelClass}>
                  <Tag className={detailLabelIconClass} aria-hidden />
                  Name
                </dt>
                {isEditingDetails ? (
                  <dd className="mt-1.5">
                    <Input
                      id="service-name"
                      value={name}
                      disabled={readOnly}
                      className={fieldInputClass}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </dd>
                ) : (
                  <dd className="text-foreground">{service.name.trim() || "—"}</dd>
                )}
              </div>
              <div className="space-y-1">
                <dt className={detailLabelClass}>
                  <CircleDot className={detailLabelIconClass} aria-hidden />
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
                  <Layers className={detailLabelIconClass} aria-hidden />
                  Type
                </dt>
                <dd className="text-foreground">
                  {service.serviceType ? serviceTypeLabel(service) : "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className={detailLabelClass}>
                  <Calculator className={detailLabelIconClass} aria-hidden />
                  Pricing model
                </dt>
                <dd className="text-foreground">{pricingModelLabel(service)}</dd>
              </div>
              <div className="space-y-1">
                <dt className={detailLabelClass}>
                  <CreditCard className={detailLabelIconClass} aria-hidden />
                  Billing
                </dt>
                <dd className="text-foreground">{billingLabel(service)}</dd>
              </div>
              <div className="space-y-1">
                <dt className={detailLabelClass}>
                  <DollarSign className={detailLabelIconClass} aria-hidden />
                  Pricing
                </dt>
                <dd className="text-foreground">{pricingDetailLabel(service)}</dd>
              </div>
            </dl>

            <div className="space-y-1 border-t border-border/60 pt-4">
              <p className={detailLabelClass}>
                <AlignLeft className={detailLabelIconClass} aria-hidden />
                Description
              </p>
              {isEditingDetails ? (
                <textarea
                  id="service-description"
                  rows={3}
                  value={description}
                  disabled={readOnly}
                  className={descriptionTextareaClass}
                  placeholder="Provide a brief description of the product or service"
                  onChange={(e) => setDescription(e.target.value)}
                />
              ) : (
                <p className="text-sm text-foreground">
                  {service.description?.trim() ? service.description.trim() : "—"}
                </p>
              )}
            </div>

            {isPlan ? (
              <div className="space-y-4 border-t border-border/60 pt-4">
                <p className={detailLabelClass}>
                  <Users className={detailLabelIconClass} aria-hidden />
                  Entitlements
                </p>
                {isEditingDetails ? (
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
                ) : (
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <dt className="text-[13px] text-muted-foreground">Included users</dt>
                      <dd className="tabular-nums text-foreground">{service.includedUsers}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-[13px] text-muted-foreground">Included locations</dt>
                      <dd className="tabular-nums text-foreground">{service.includedLocations}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-[13px] text-muted-foreground">Included admins</dt>
                      <dd className="tabular-nums text-foreground">{service.includedAdmins}</dd>
                    </div>
                  </dl>
                )}
              </div>
            ) : null}

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
