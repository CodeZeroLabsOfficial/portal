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
  DialogDescription,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[34rem]">
        <DialogHeader>
          <DialogTitle>Add subscription</DialogTitle>
          <DialogDescription>
            Create a Stripe subscription for a CRM customer using an existing Stripe Price id.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormServerError message={serverError} rounded="xl" />

          <div className="space-y-2">
            <Label htmlFor="customerId">Customer</Label>
            <select
              id="customerId"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
              <p className="text-xs text-destructive">{form.formState.errors.customerId.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priceId">Stripe Price id</Label>
            <Input
              id="priceId"
              placeholder="price_1234..."
              autoComplete="off"
              disabled={busy}
              {...form.register("priceId")}
            />
            {form.formState.errors.priceId ? (
              <p className="text-xs text-destructive">{form.formState.errors.priceId.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="collectionMethod">Collection method</Label>
            <select
              id="collectionMethod"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            <div className="space-y-2">
              <Label htmlFor="daysUntilDue">Days until due</Label>
              <Input
                id="daysUntilDue"
                type="number"
                min={1}
                max={90}
                disabled={busy}
                value={form.watch("daysUntilDue") ?? 14}
                onChange={(e) =>
                  form.setValue("daysUntilDue", Number(e.target.value), { shouldValidate: true })
                }
              />
              {form.formState.errors.daysUntilDue ? (
                <p className="text-xs text-destructive">{form.formState.errors.daysUntilDue.message}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="defaultPaymentMethodId">Default payment method id (optional)</Label>
              <Input
                id="defaultPaymentMethodId"
                placeholder="pm_... (card, direct debit, etc.)"
                autoComplete="off"
                disabled={busy}
                {...form.register("defaultPaymentMethodId")}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Create subscription
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
