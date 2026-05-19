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
  Package,
  Tag,
  Users,
} from "lucide-react";
import {
  archiveCatalogServiceAction,
  saveAndActivateCatalogServiceAction,
  saveAndSyncCatalogServiceStripeAction,
  saveCatalogServiceAction,
} from "@/server/actions/catalog-services";
import type { CatalogServiceRecord, CatalogServiceStatus } from "@/types/catalog-service";
import { CatalogServiceStripeIntegrationsCard } from "@/components/portal/catalog-service-stripe-integrations-card";
import { InlineEditableField } from "@/components/portal/inline-editable-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const detailLabelClass =
  "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

const detailLabelIconClass = "h-3.5 w-3.5 shrink-0 opacity-80";

type ServiceFieldOverrides = {
  name?: string;
  description?: string;
  includedUsers?: number;
  includedLocations?: number;
  includedAdmins?: number;
};

export interface CatalogServiceEditFormProps {
  service: CatalogServiceRecord;
}

export function CatalogServiceEditForm({ service }: CatalogServiceEditFormProps) {
  const router = useRouter();
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [activeFieldId, setActiveFieldId] = React.useState<string | null>(null);

  const st = statusBadge(service.status);
  const fieldsDisabled = service.status === "archived";
  const readOnly = fieldsDisabled || busy;
  const isPlan = service.serviceType !== "addon";

  function buildSavePayload(overrides: ServiceFieldOverrides = {}) {
    return {
      serviceId: service.id,
      name: (overrides.name ?? service.name).trim(),
      description:
        overrides.description !== undefined
          ? overrides.description.trim() || undefined
          : service.description?.trim() || undefined,
      currency: service.currency,
      includedUsers: overrides.includedUsers ?? service.includedUsers,
      includedLocations: overrides.includedLocations ?? service.includedLocations,
      includedAdmins: overrides.includedAdmins ?? service.includedAdmins,
      monthlyCost12Minor: termMinor(service, 12),
      monthlyCost24Minor: termMinor(service, 24),
      ...(typeof service.upfrontCost12Minor === "number"
        ? { upfrontCost12Minor: service.upfrontCost12Minor }
        : {}),
      features: service.features,
    };
  }

  async function persistField(
    overrides: ServiceFieldOverrides,
  ): Promise<{ ok: boolean; message?: string }> {
    const res = await saveCatalogServiceAction(buildSavePayload(overrides));
    if (res.ok) {
      router.refresh();
    }
    return res;
  }

  function parseNonNegativeInt(raw: string, label: string): { ok: true; value: number } | { ok: false; message: string } {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, message: `Enter a valid ${label}.` };
    }
    return { ok: true, value: n };
  }

  async function runAction(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    opts?: { redirectToList?: boolean },
  ) {
    setBusy(true);
    setMessage(null);
    setActiveFieldId(null);
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
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className={detailLabelClass}>
                  <Tag className={detailLabelIconClass} aria-hidden />
                  Name
                </dt>
                <dd>
                  <InlineEditableField
                    fieldId="name"
                    activeFieldId={activeFieldId}
                    onActiveFieldIdChange={setActiveFieldId}
                    value={service.name}
                    editLabel="name"
                    placeholder="Service name"
                    disabled={fieldsDisabled}
                    onSave={async (next) => {
                      const trimmed = next.trim();
                      if (!trimmed) {
                        return { ok: false, message: "Name is required." };
                      }
                      if (trimmed.length > 120) {
                        return { ok: false, message: "Name must be 120 characters or fewer." };
                      }
                      return persistField({ name: trimmed });
                    }}
                  />
                </dd>
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
              <InlineEditableField
                fieldId="description"
                activeFieldId={activeFieldId}
                onActiveFieldIdChange={setActiveFieldId}
                value={service.description ?? ""}
                editLabel="description"
                placeholder="Provide a brief description of the product or service"
                multiline
                disabled={fieldsDisabled}
                onSave={async (next) => {
                  const trimmed = next.trim();
                  if (trimmed.length > 500) {
                    return { ok: false, message: "Description must be 500 characters or fewer." };
                  }
                  return persistField({ description: trimmed });
                }}
              />
            </div>

            {isPlan ? (
              <div className="space-y-4 border-t border-border/60 pt-4">
                <p className={detailLabelClass}>
                  <Users className={detailLabelIconClass} aria-hidden />
                  Entitlements
                </p>
                <dl className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <dt className="text-[13px] text-muted-foreground">Included users</dt>
                    <dd>
                      <InlineEditableField
                        fieldId="includedUsers"
                        activeFieldId={activeFieldId}
                        onActiveFieldIdChange={setActiveFieldId}
                        value={String(service.includedUsers)}
                        editLabel="included users"
                        inputType="number"
                        inputMin={0}
                        disabled={fieldsDisabled}
                        onSave={async (next) => {
                          const parsed = parseNonNegativeInt(next, "number of users");
                          if (!parsed.ok) return parsed;
                          return persistField({ includedUsers: parsed.value });
                        }}
                      />
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[13px] text-muted-foreground">Included locations</dt>
                    <dd>
                      <InlineEditableField
                        fieldId="includedLocations"
                        activeFieldId={activeFieldId}
                        onActiveFieldIdChange={setActiveFieldId}
                        value={String(service.includedLocations)}
                        editLabel="included locations"
                        inputType="number"
                        inputMin={0}
                        disabled={fieldsDisabled}
                        onSave={async (next) => {
                          const parsed = parseNonNegativeInt(next, "number of locations");
                          if (!parsed.ok) return parsed;
                          return persistField({ includedLocations: parsed.value });
                        }}
                      />
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[13px] text-muted-foreground">Included admins</dt>
                    <dd>
                      <InlineEditableField
                        fieldId="includedAdmins"
                        activeFieldId={activeFieldId}
                        onActiveFieldIdChange={setActiveFieldId}
                        value={String(service.includedAdmins)}
                        editLabel="included admins"
                        inputType="number"
                        inputMin={0}
                        disabled={fieldsDisabled}
                        onSave={async (next) => {
                          const parsed = parseNonNegativeInt(next, "number of admins");
                          if (!parsed.ok) return parsed;
                          return persistField({ includedAdmins: parsed.value });
                        }}
                      />
                    </dd>
                  </div>
                </dl>
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
