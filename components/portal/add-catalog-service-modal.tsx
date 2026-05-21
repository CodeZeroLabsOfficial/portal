"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2 } from "lucide-react";
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
import { NumericStepper } from "@/components/ui/numeric-stepper";
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
  includedUsers: 0,
  includedLocations: 0,
  includedAdmins: 0,
};

const fieldClass =
  "border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500";
const labelClass = "text-zinc-300";
const selectClass =
  "flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]";
const sectionHeaderClass = "px-3 py-2 text-xs font-medium text-zinc-400";
const sectionRowClass =
  "flex items-center justify-between gap-3 border-t border-white/[0.06] px-3 py-2.5";
const sectionShellClass =
  "overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]";
const priceInputClass = cn(
  fieldClass,
  "h-9 w-[8.5rem] shrink-0 border-0 bg-white/[0.04] text-right text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring",
);

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

function PricingRow({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  error,
  placeholder = "0.00",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  placeholder?: string;
}) {
  return (
    <li className={sectionRowClass}>
      <Label htmlFor={id} className={cn(labelClass, "font-normal")}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <div className="flex flex-col items-end gap-1">
        <Input
          id={id}
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          className={priceInputClass}
          onChange={(e) => onChange(e.target.value)}
        />
        {error ? <p className="text-xs leading-tight text-destructive">{error}</p> : null}
      </div>
    </li>
  );
}

function EntitlementRow({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <li className={sectionRowClass}>
      <Label htmlFor={id} className={cn(labelClass, "font-normal")}>
        {label}
      </Label>
      <NumericStepper
        id={id}
        variant="glass"
        value={value}
        max={1_000_000}
        disabled={disabled}
        aria-label={label}
        onChange={onChange}
      />
    </li>
  );
}

export function AddCatalogServiceModal({ open, onOpenChange }: AddCatalogServiceModalProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [lookupKeyBase, setLookupKeyBase] = React.useState("");
  const [lookupTouched, setLookupTouched] = React.useState(false);
  const [flatPrice, setFlatPrice] = React.useState("");
  const [upfrontPrice, setUpfrontPrice] = React.useState("");
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
  const includedUsers = form.watch("includedUsers") ?? 0;
  const includedLocations = form.watch("includedLocations") ?? 0;
  const includedAdmins = form.watch("includedAdmins") ?? 0;

  const isPlan = serviceType === "plan";
  const isOneOff = billingType === "one_off";
  const isFlat = isOneOff || pricingModel === "flat";
  const isByTerm = !isOneOff && pricingModel === "by_term";
  const showUpfront = isPlan && isByTerm;

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
      setUpfrontPrice("");
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
      form.setValue("upfrontCost12Minor", undefined, { shouldValidate: false });
    } else {
      form.setValue("monthlyCost12Minor", majorInputToMinor(monthly12), { shouldValidate: false });
      form.setValue("monthlyCost24Minor", majorInputToMinor(monthly24), { shouldValidate: false });
      const upfrontMinor = majorInputToMinor(upfrontPrice);
      form.setValue(
        "upfrontCost12Minor",
        showUpfront && upfrontMinor > 0 ? upfrontMinor : undefined,
        { shouldValidate: false },
      );
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
    const upfrontMinor = showUpfront ? majorInputToMinor(upfrontPrice) : 0;
    const payload: CreateCatalogServiceInput = {
      ...values,
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      lookupKeyBase: resolvedLookupBase,
      pricingModel: effectivePricing,
      flatAmountMinor: isFlat ? majorInputToMinor(flatPrice) : undefined,
      monthlyCost12Minor: isByTerm ? majorInputToMinor(monthly12) : undefined,
      monthlyCost24Minor: isByTerm ? majorInputToMinor(monthly24) : undefined,
      upfrontCost12Minor: showUpfront && upfrontMinor > 0 ? upfrontMinor : undefined,
      includedUsers: isPlan ? Math.max(0, Math.floor(Number(values.includedUsers) || 0)) : 0,
      includedLocations: isPlan ? Math.max(0, Math.floor(Number(values.includedLocations) || 0)) : 0,
      includedAdmins: isPlan ? Math.max(0, Math.floor(Number(values.includedAdmins) || 0)) : 0,
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

          <div className="space-y-1.5">
            <Label htmlFor="catalog-service-name" className={labelClass}>
              Service or product name <span className="text-destructive">*</span>
            </Label>
            <div className="flex overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.04] focus-within:ring-2 focus-within:ring-ring">
              <div className="relative shrink-0 border-r border-white/[0.08]">
                <select
                  id="catalog-service-type"
                  className="h-9 appearance-none bg-transparent py-1 pl-3 pr-7 text-sm text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
                  disabled={busy}
                  value={serviceType}
                  aria-label="Service type"
                  onChange={(e) =>
                    form.setValue("serviceType", e.target.value as CatalogServiceKind, { shouldDirty: true })
                  }
                >
                  <option value="plan">Plan</option>
                  <option value="addon">Add-on</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                  aria-hidden
                />
              </div>
              <Input
                id="catalog-service-name"
                autoComplete="off"
                className="h-9 flex-1 rounded-none border-0 bg-transparent text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0"
                placeholder="Service or product name"
                disabled={busy}
                {...form.register("name")}
              />
            </div>
            {errors.name ? (
              <p className="text-xs leading-tight text-destructive">{errors.name.message}</p>
            ) : null}
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
                <option value="by_term">Fixed term</option>
              </select>
              {isOneOff ? (
                <p className="text-xs text-zinc-500">One-off charges use a single flat price.</p>
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

          <div className={cn("grid gap-4", isPlan ? "md:grid-cols-2" : "md:grid-cols-1")}>
            <div className={sectionShellClass}>
              <p className={cn(sectionHeaderClass, "border-b border-white/[0.06]")}>Pricing</p>
              <ul>
                {isFlat ? (
                  <PricingRow
                    id="catalog-flat-price"
                    label={isOneOff ? "One-off price (AUD)" : "Monthly price (AUD)"}
                    value={flatPrice}
                    disabled={busy}
                    required
                    error={errors.flatAmountMinor?.message}
                    onChange={setFlatPrice}
                  />
                ) : (
                  <>
                    {showUpfront ? (
                      <PricingRow
                        id="catalog-upfront-price"
                        label="Upfront price (AUD)"
                        value={upfrontPrice}
                        disabled={busy}
                        placeholder="0.00"
                        onChange={setUpfrontPrice}
                      />
                    ) : null}
                    <PricingRow
                      id="catalog-m12"
                      label="12-month price (AUD)"
                      value={monthly12}
                      disabled={busy}
                      required
                      error={errors.monthlyCost12Minor?.message}
                      onChange={setMonthly12}
                    />
                    <PricingRow
                      id="catalog-m24"
                      label="24-month price (AUD)"
                      value={monthly24}
                      disabled={busy}
                      required
                      error={errors.monthlyCost24Minor?.message}
                      onChange={setMonthly24}
                    />
                  </>
                )}
              </ul>
            </div>

            {isPlan ? (
              <div className={sectionShellClass}>
                <p className={cn(sectionHeaderClass, "border-b border-white/[0.06]")}>Entitlements</p>
                <ul>
                  <EntitlementRow
                    id="catalog-included-users"
                    label="Included users"
                    value={includedUsers}
                    disabled={busy}
                    onChange={(next) =>
                      form.setValue("includedUsers", next, { shouldDirty: true, shouldValidate: true })
                    }
                  />
                  <EntitlementRow
                    id="catalog-included-locations"
                    label="Included locations"
                    value={includedLocations}
                    disabled={busy}
                    onChange={(next) =>
                      form.setValue("includedLocations", next, { shouldDirty: true, shouldValidate: true })
                    }
                  />
                  <EntitlementRow
                    id="catalog-included-admins"
                    label="Included admins"
                    value={includedAdmins}
                    disabled={busy}
                    onChange={(next) =>
                      form.setValue("includedAdmins", next, { shouldDirty: true, shouldValidate: true })
                    }
                  />
                </ul>
              </div>
            ) : null}
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
