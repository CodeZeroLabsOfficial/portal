"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { createSubscriptionSchema, type CreateSubscriptionInput } from "@/lib/schemas/subscription";
import { createSubscriptionAction } from "@/server/actions/subscriptions-crm";
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
import { formatCurrencyAmount } from "@/lib/format";
import type { SubscriptionProductOption } from "@/types/subscription-product";

interface AddSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerOptions: { id: string; label: string }[];
  productOptions: SubscriptionProductOption[];
}

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const defaultValues: CreateSubscriptionInput = {
  customerId: "",
  priceId: "",
  startDate: todayIsoDate(),
  durationMonths: 12,
  collectionMethod: "charge_automatically",
  daysUntilDue: undefined,
  defaultPaymentMethodId: undefined,
};

export function AddSubscriptionModal({
  open,
  onOpenChange,
  customerOptions,
  productOptions,
}: AddSubscriptionModalProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<CreateSubscriptionInput>({
    resolver: zodResolver(createSubscriptionSchema),
    defaultValues,
  });

  const collectionMethod = form.watch("collectionMethod");
  const selectedProductId = form.watch("priceId");
  const selectedProduct = React.useMemo(
    () => productOptions.find((p) => p.productId === selectedProductId),
    [productOptions, selectedProductId],
  );
  const durationOptions = selectedProduct?.durations ?? [];

  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setServerError(null);
    }
  }, [open, form]);

  React.useEffect(() => {
    if (!open) return;
    const firstProduct = productOptions[0];
    if (firstProduct && !selectedProductId) {
      form.setValue("priceId", firstProduct.productId, { shouldValidate: true });
      if (firstProduct.durations[0]) {
        form.setValue("durationMonths", firstProduct.durations[0].months, { shouldValidate: true });
      }
    }
  }, [open, productOptions, selectedProductId, form]);

  React.useEffect(() => {
    if (!selectedProduct) return;
    const current = form.getValues("durationMonths");
    const valid = selectedProduct.durations.some((d) => d.months === current);
    if (!valid && selectedProduct.durations[0]) {
      form.setValue("durationMonths", selectedProduct.durations[0].months, { shouldValidate: true });
    }
  }, [selectedProduct, form]);

  async function onSubmit(values: CreateSubscriptionInput) {
    setServerError(null);
    const duration = durationOptions.find((d) => d.months === values.durationMonths);
    if (!duration) {
      setServerError("Select a valid duration for the selected product.");
      return;
    }
    const payload: CreateSubscriptionInput = {
      ...values,
      priceId: duration.priceId,
      daysUntilDue:
        values.collectionMethod === "send_invoice" ? values.daysUntilDue ?? 14 : undefined,
      defaultPaymentMethodId:
        values.collectionMethod === "charge_automatically"
          ? values.defaultPaymentMethodId?.trim() || undefined
          : undefined,
    };
    const result = await createSubscriptionAction(payload);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,760px)] w-[min(100vw-2rem,720px)] max-w-[720px] overflow-y-auto border-white/[0.08] bg-[#141414] p-0 sm:max-w-[720px]">
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">New subscription</DialogTitle>
          </DialogHeader>
        </div>

        <form className="space-y-3 px-6 py-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormServerError message={serverError} rounded="xl" />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerId" className="text-zinc-300">
              Customer
            </Label>
            <select
              id="customerId"
              className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
              disabled={busy}
              value={form.watch("customerId")}
              onChange={(e) => form.setValue("customerId", e.target.value, { shouldValidate: true })}
            >
              <option value="">Select customer</option>
              {customerOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            {form.formState.errors.customerId ? (
              <p className="text-xs leading-tight text-destructive">{form.formState.errors.customerId.message}</p>
            ) : null}
          </div>

          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subscriptionProduct" className="text-zinc-300">
                Product
              </Label>
              <select
                id="subscriptionProduct"
                className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
                disabled={busy || productOptions.length === 0}
                value={selectedProductId}
                onChange={(e) => form.setValue("priceId", e.target.value, { shouldValidate: true })}
              >
                {productOptions.length === 0 ? <option value="">No Stripe products found</option> : null}
                {productOptions.map((opt) => (
                  <option key={opt.productId} value={opt.productId}>
                    {opt.productName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="durationMonths" className="text-zinc-300">
                Duration
              </Label>
              <select
                id="durationMonths"
                className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
                disabled={busy || durationOptions.length === 0}
                value={form.watch("durationMonths")}
                onChange={(e) => form.setValue("durationMonths", Number(e.target.value), { shouldValidate: true })}
              >
                {durationOptions.length === 0 ? <option value="">No durations</option> : null}
                {durationOptions.map((d) => (
                  <option key={`${selectedProductId}-${d.months}`} value={d.months}>
                    {d.months} months · {formatCurrencyAmount(d.unitAmountMinor, d.currency)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate" className="text-zinc-300">
              Start date
            </Label>
            <Input
              id="startDate"
              type="date"
              disabled={busy}
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
              {...form.register("startDate")}
            />
            {form.formState.errors.startDate ? (
              <p className="text-xs leading-tight text-destructive">{form.formState.errors.startDate.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collectionMethod" className="text-zinc-300">
              Collection method
            </Label>
            <select
              id="collectionMethod"
              className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
              disabled={busy}
              value={collectionMethod}
              onChange={(e) =>
                form.setValue(
                  "collectionMethod",
                  e.target.value as CreateSubscriptionInput["collectionMethod"],
                  { shouldValidate: true },
                )
              }
            >
              <option value="charge_automatically">Automatic charge</option>
              <option value="send_invoice">Send invoice</option>
            </select>
          </div>

          {collectionMethod === "send_invoice" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="daysUntilDue" className="text-zinc-300">
                Days until due
              </Label>
              <Input
                id="daysUntilDue"
                type="number"
                min={1}
                max={90}
                disabled={busy}
                value={form.watch("daysUntilDue") ?? 14}
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                onChange={(e) =>
                  form.setValue("daysUntilDue", Number(e.target.value), { shouldValidate: true })
                }
              />
              {form.formState.errors.daysUntilDue ? (
                <p className="text-xs leading-tight text-destructive">{form.formState.errors.daysUntilDue.message}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="defaultPaymentMethodId" className="text-zinc-300">
                Default payment method id (optional)
              </Label>
              <Input
                id="defaultPaymentMethodId"
                placeholder="pm_... (card, direct debit, etc.)"
                autoComplete="off"
                disabled={busy}
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                {...form.register("defaultPaymentMethodId")}
              />
            </div>
          )}

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
