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

interface AddSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerOptions: { id: string; label: string }[];
}

const defaultValues: CreateSubscriptionInput = {
  customerId: "",
  priceId: "",
  collectionMethod: "charge_automatically",
  daysUntilDue: undefined,
  defaultPaymentMethodId: undefined,
};

export function AddSubscriptionModal({
  open,
  onOpenChange,
  customerOptions,
}: AddSubscriptionModalProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<CreateSubscriptionInput>({
    resolver: zodResolver(createSubscriptionSchema),
    defaultValues,
  });

  const collectionMethod = form.watch("collectionMethod");

  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setServerError(null);
    }
  }, [open, form]);

  async function onSubmit(values: CreateSubscriptionInput) {
    setServerError(null);
    const payload: CreateSubscriptionInput = {
      ...values,
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priceId" className="text-zinc-300">
              Stripe Price id
            </Label>
            <Input
              id="priceId"
              placeholder="price_1234..."
              autoComplete="off"
              disabled={busy}
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
              {...form.register("priceId")}
            />
            {form.formState.errors.priceId ? (
              <p className="text-xs leading-tight text-destructive">{form.formState.errors.priceId.message}</p>
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
