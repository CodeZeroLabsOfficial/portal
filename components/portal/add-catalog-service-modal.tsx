"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  buildCatalogServicePriceLookupKey,
  normalizeLookupKeyBase,
  previewCatalogServiceLookupKeys,
  slugifyCatalogServiceName,
} from "@/lib/catalog-service-slug";
import {
  createCatalogServiceSchema,
  type CreateCatalogServiceInput,
} from "@/lib/schemas/catalog-service";
import { createCatalogServiceAction } from "@/server/actions/catalog-services";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormServerError } from "@/components/ui/form-server-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { WORKSPACE_GLASS_DIALOG_SURFACE_CLASSES } from "@/lib/workspace-glass";
import type { CatalogServiceKind } from "@/types/catalog-service";

interface AddCatalogServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultValues: CreateCatalogServiceInput = {
  serviceType: "plan",
  name: "",
  description: "",
  billingType: "recurring",
  pricingModel: "by_term",
  lookupKeyBase: "",
  currency: "aud",
  flatAmountMinor: 0,
  monthlyCost12Minor: 0,
  monthlyCost24Minor: 0,
  syncToStripe: false,
};

const fieldClass =
  "border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500";
const labelClass = "text-zinc-300";
const selectClass =
  "flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]";

function majorInputToMinor(raw: string): number {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function AddCatalogServiceModal({ open, onOpenChange }: AddCatalogServiceModalProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [lookupKeyBase, setLookupKeyBase] = React.useState("");
  const [lookupTouched, setLookupTouched] = React.useState(false);
  const [flatPrice, setFlatPrice] = React.useState("");
  const [monthly12, setMonthly12] = React.useState("");
  const [monthly24, setMonthly24] = React.useState("");

  const form = useForm<CreateCatalogServiceInput>({
    resolver: zodResolver(createCatalogServiceSchema),
    defaultValues,
  });

  const name = form.watch("name");
  const serviceType = form.watch("serviceType");
  const billingType = form.watch("billingType");
  const pricingModel = form.watch("pricingModel");
  const syncToStripe = form.watch("syncToStripe");

  const isOneOff = billingType === "one_off";
  const isFlat = isOneOff || pricingModel === "flat";
  const isByTerm = !isOneOff && pricingModel === "by_term";

  const resolvedLookupBase =
    normalizeLookupKeyBase(lookupKeyBase) || slugifyCatalogServiceName(name);

  const lookupPreview = React.useMemo(() => {
    const ctx = {
      lookupKeyBase: resolvedLookupBase,
      serviceType: serviceType as CatalogServiceKind,
      billingType,
      pricingModel: isOneOff ? ("flat" as const) : pricingModel,
    };
    return previewCatalogServiceLookupKeys(ctx);
  }, [resolvedLookupBase, serviceType, billingType, pricingModel, isOneOff]);

  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setLookupKeyBase("");
      setLookupTouched(false);
      setFlatPrice("");
      setMonthly12("");
      setMonthly24("");
      setServerError(null);
    }
  }, [open, form]);

  React.useEffect(() => {
    if (!lookupTouched) {
      setLookupKeyBase(slugifyCatalogServiceName(name));
    }
  }, [name, lookupTouched]);

  React.useEffect(() => {
    if (isOneOff && pricingModel !== "flat") {
      form.setValue("pricingModel", "flat", { shouldDirty: true });
    }
  }, [isOneOff, pricingModel, form]);

  async function onSubmit(values: CreateCatalogServiceInput) {
    setServerError(null);
    const effectivePricing = values.billingType === "one_off" ? "flat" : values.pricingModel;
    const payload: CreateCatalogServiceInput = {
      ...values,
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      lookupKeyBase: resolvedLookupBase,
      pricingModel: effectivePricing,
      flatAmountMinor: isFlat ? majorInputToMinor(flatPrice) : undefined,
      monthlyCost12Minor: isByTerm ? majorInputToMinor(monthly12) : undefined,
      monthlyCost24Minor: isByTerm ? majorInputToMinor(monthly24) : undefined,
    };
    const result = await createCatalogServiceAction(payload);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    onOpenChange(false);
    router.push(`/admin/services/${result.serviceId}`);
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(90vh,800px)] w-[min(100vw-2rem,640px)] max-w-[640px] overflow-y-auto p-0 sm:max-w-[640px]",
          WORKSPACE_GLASS_DIALOG_SURFACE_CLASSES,
        )}
      >
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">New service</DialogTitle>
          </DialogHeader>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 px-6 py-5"
          noValidate
        >
          <FormServerError message={serverError} rounded="xl" />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catalog-service-type" className={labelClass}>
              Service type <span className="text-destructive">*</span>
            </Label>
            <select
              id="catalog-service-type"
              className={selectClass}
              disabled={busy}
              value={serviceType}
              onChange={(e) =>
                form.setValue("serviceType", e.target.value as CatalogServiceKind, { shouldDirty: true })
              }
            >
              <option value="plan">Plan</option>
              <option value="addon">Add-on</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catalog-service-name" className={labelClass}>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="catalog-service-name"
              autoComplete="off"
              className={fieldClass}
              placeholder={serviceType === "plan" ? "Professional plan" : "Extra location"}
              disabled={busy}
              {...form.register("name")}
            />
            <p className="text-xs text-zinc-500">Stripe product name</p>
            {form.formState.errors.name ? (
              <p className="text-xs leading-tight text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catalog-service-description" className={labelClass}>
              Description
            </Label>
            <textarea
              id="catalog-service-description"
              rows={2}
              disabled={busy}
              className={cn(
                "min-h-[4rem] w-full rounded-md border px-3 py-2 text-sm",
                fieldClass,
              )}
              placeholder="Shown on Stripe prices and product details"
              {...form.register("description")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className={labelClass}>Billing</Label>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="radio"
                    name="billingType"
                    className="h-4 w-4"
                    checked={billingType === "recurring"}
                    disabled={busy}
                    onChange={() => form.setValue("billingType", "recurring", { shouldDirty: true })}
                  />
                  Recurring
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="radio"
                    name="billingType"
                    className="h-4 w-4"
                    checked={billingType === "one_off"}
                    disabled={busy}
                    onChange={() => form.setValue("billingType", "one_off", { shouldDirty: true })}
                  />
                  One-off
                </label>
              </div>
            </div>

            <div className={cn("flex flex-col gap-1.5", isOneOff && "opacity-50")}>
              <Label className={labelClass}>Pricing model</Label>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="radio"
                    name="pricingModel"
                    className="h-4 w-4"
                    checked={pricingModel === "flat"}
                    disabled={busy || isOneOff}
                    onChange={() => form.setValue("pricingModel", "flat", { shouldDirty: true })}
                  />
                  Flat rate (one price)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="radio"
                    name="pricingModel"
                    className="h-4 w-4"
                    checked={pricingModel === "by_term"}
                    disabled={busy || isOneOff}
                    onChange={() => form.setValue("pricingModel", "by_term", { shouldDirty: true })}
                  />
                  12 & 24 month
                </label>
              </div>
              {isOneOff ? (
                <p className="text-xs text-zinc-500">One-off charges use a single flat price.</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catalog-lookup-key" className={labelClass}>
              Lookup key <span className="text-destructive">*</span>
            </Label>
            <Input
              id="catalog-lookup-key"
              autoComplete="off"
              className={cn(fieldClass, "font-mono")}
              placeholder="professional"
              value={lookupKeyBase}
              disabled={busy}
              onChange={(e) => {
                setLookupTouched(true);
                setLookupKeyBase(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
              }}
            />
            <p className="text-xs text-zinc-500">
              Stripe lookup key{lookupPreview.length > 1 ? "s" : ""}:{" "}
              <span className="font-mono text-zinc-400">{lookupPreview.join(" · ")}</span>
            </p>
            {serviceType === "plan" && isByTerm ? (
              <p className="text-xs text-zinc-600">
                Example:{" "}
                <span className="font-mono text-zinc-500">
                  {buildCatalogServicePriceLookupKey(
                    {
                      lookupKeyBase: resolvedLookupBase || "professional",
                      serviceType: "plan",
                      billingType: "recurring",
                      pricingModel: "by_term",
                    },
                    24,
                  )}
                </span>
              </p>
            ) : null}
          </div>

          {isFlat ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catalog-flat-price" className={labelClass}>
                {isOneOff ? "One-off price (AUD)" : "Monthly price (AUD)"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="catalog-flat-price"
                inputMode="decimal"
                placeholder="0.00"
                value={flatPrice}
                disabled={busy}
                className={fieldClass}
                onChange={(e) => setFlatPrice(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="catalog-m12" className={labelClass}>
                  12-month monthly (AUD) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="catalog-m12"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={monthly12}
                  disabled={busy}
                  className={fieldClass}
                  onChange={(e) => setMonthly12(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="catalog-m24" className={labelClass}>
                  24-month monthly (AUD) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="catalog-m24"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={monthly24}
                  disabled={busy}
                  className={fieldClass}
                  onChange={(e) => setMonthly24(e.target.value)}
                />
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={Boolean(syncToStripe)}
              disabled={busy}
              onChange={(e) => form.setValue("syncToStripe", e.target.checked, { shouldDirty: true })}
            />
            <span className="text-sm leading-snug text-zinc-300">
              <span className="font-medium text-white">Activate & sync to Stripe</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Creates the Stripe product and price{lookupPreview.length > 1 ? "s" : ""} immediately. Requires at
                least $0.50 per price when enabled.
              </span>
            </span>
          </label>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              className="text-zinc-400 hover:text-white"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="min-w-[7rem] gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
