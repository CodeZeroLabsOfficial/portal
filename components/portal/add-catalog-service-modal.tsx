"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import {
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

/** Derive lookup key from name; leave empty until the user enters a name. */
function lookupKeyBaseFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return slugifyCatalogServiceName(trimmed);
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

  const isOneOff = billingType === "one_off";
  const isFlat = isOneOff || pricingModel === "flat";
  const isByTerm = !isOneOff && pricingModel === "by_term";

  const resolvedLookupBase =
    normalizeLookupKeyBase(lookupKeyBase) || lookupKeyBaseFromName(name);

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
      setLookupKeyBase(lookupKeyBaseFromName(name));
    }
  }, [name, lookupTouched]);

  React.useEffect(() => {
    if (isOneOff && pricingModel !== "flat") {
      form.setValue("pricingModel", "flat", { shouldDirty: true });
    }
  }, [isOneOff, pricingModel, form]);

  function syncFormFromControls() {
    form.setValue("lookupKeyBase", resolvedLookupBase, { shouldValidate: false });
    if (isFlat) {
      form.setValue("flatAmountMinor", majorInputToMinor(flatPrice), { shouldValidate: false });
    } else {
      form.setValue("monthlyCost12Minor", majorInputToMinor(monthly12), { shouldValidate: false });
      form.setValue("monthlyCost24Minor", majorInputToMinor(monthly24), { shouldValidate: false });
    }
  }

  function onInvalid(errors: FieldErrors<CreateCatalogServiceInput>) {
    const messages = [
      errors.name?.message,
      errors.lookupKeyBase?.message,
      errors.flatAmountMinor?.message,
      errors.monthlyCost12Minor?.message,
      errors.monthlyCost24Minor?.message,
      errors.pricingModel?.message,
    ].filter((m): m is string => typeof m === "string" && m.length > 0);
    setServerError(messages[0] ?? "Please check the form and try again.");
  }

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

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    syncFormFromControls();
    void form.handleSubmit(onSubmit, onInvalid)(e);
  }

  const busy = form.formState.isSubmitting;
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(90vh,860px)] w-[min(100vw-2rem,880px)] max-w-[880px] overflow-y-auto p-0 sm:max-w-[880px]",
          WORKSPACE_GLASS_DIALOG_SURFACE_CLASSES,
        )}
      >
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">Add a new service</DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4 px-8 py-6" noValidate>
          <FormServerError message={serverError} rounded="xl" />

          <div className="grid gap-4 md:grid-cols-2">
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
                placeholder="Service or product name"
                disabled={busy}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
                <p className="text-xs leading-tight text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
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
                "min-h-[3.25rem] w-full resize-none rounded-md border px-3 py-2 text-sm",
                fieldClass,
              )}
              placeholder="Provide a brief description of the product or service"
              {...form.register("description")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catalog-billing-type" className={labelClass}>
                Billing
              </Label>
              <select
                id="catalog-billing-type"
                className={selectClass}
                disabled={busy}
                value={billingType}
                onChange={(e) =>
                  form.setValue("billingType", e.target.value as "recurring" | "one_off", {
                    shouldDirty: true,
                  })
                }
              >
                <option value="recurring">Recurring</option>
                <option value="one_off">One-off</option>
              </select>
            </div>

            <div className={cn("flex flex-col gap-1.5", isOneOff && "opacity-50")}>
              <Label htmlFor="catalog-pricing-model" className={labelClass}>
                Pricing model
              </Label>
              <select
                id="catalog-pricing-model"
                className={selectClass}
                disabled={busy || isOneOff}
                value={isOneOff ? "flat" : pricingModel}
                onChange={(e) =>
                  form.setValue("pricingModel", e.target.value as "flat" | "by_term", { shouldDirty: true })
                }
              >
                <option value="flat">Flat rate (one price)</option>
                <option value="by_term">12 & 24 month</option>
              </select>
              {isOneOff ? (
                <p className="text-xs text-zinc-500">One-off charges use a single flat price.</p>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              "grid gap-4",
              isFlat ? "md:grid-cols-[1fr_minmax(10rem,14rem)]" : "md:grid-cols-3",
            )}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catalog-lookup-key" className={labelClass}>
                Lookup key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="catalog-lookup-key"
                autoComplete="off"
                className={cn(fieldClass, "font-mono")}
                placeholder="Enter unique lookup key (e.g. premium_monthly)"
                value={lookupKeyBase}
                disabled={busy}
                onChange={(e) => {
                  setLookupTouched(true);
                  setLookupKeyBase(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                }}
              />
              {errors.lookupKeyBase ? (
                <p className="text-xs leading-tight text-destructive">{errors.lookupKeyBase.message}</p>
              ) : null}
              {resolvedLookupBase ? (
                <p className="text-xs leading-snug text-zinc-500">
                  Stripe lookup key{lookupPreview.length > 1 ? "s" : ""}:{" "}
                  <span className="font-mono text-zinc-400">{lookupPreview.join(" · ")}</span>
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
                {errors.flatAmountMinor ? (
                  <p className="text-xs leading-tight text-destructive">{errors.flatAmountMinor.message}</p>
                ) : null}
              </div>
            ) : (
              <>
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
                  {errors.monthlyCost12Minor ? (
                    <p className="text-xs leading-tight text-destructive">{errors.monthlyCost12Minor.message}</p>
                  ) : null}
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
                  {errors.monthlyCost24Minor ? (
                    <p className="text-xs leading-tight text-destructive">{errors.monthlyCost24Minor.message}</p>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 border-t border-white/[0.06] pt-4 sm:justify-end">
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
