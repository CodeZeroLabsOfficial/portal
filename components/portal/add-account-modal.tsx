"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  createAccountFormSchema,
  type CreateAccountFormInput,
} from "@/lib/schemas/account";
import { createAccountAction } from "@/server/actions/accounts-crm";
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

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultValues: CreateAccountFormInput = {
  company: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  companyAddressLine1: "",
  companyAddressLine2: "",
  companyCity: "",
  companyRegion: "",
  companyPostalCode: "",
  companyCountry: "",
};

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<CreateAccountFormInput>({
    resolver: zodResolver(createAccountFormSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setServerError(null);
    }
  }, [open, form]);

  async function onSubmit(values: CreateAccountFormInput) {
    setServerError(null);
    const result = await createAccountAction(values);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    onOpenChange(false);
    router.push(`/admin/accounts/${result.accountKey}`);
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,800px)] w-[min(100vw-2rem,720px)] max-w-[720px] overflow-y-auto border-white/[0.08] bg-[#141414] p-0 sm:max-w-[720px]">
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">
              New account
            </DialogTitle>
          </DialogHeader>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3 px-6 py-5"
          noValidate
        >
          <FormServerError message={serverError} rounded="xl" />

          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="account-company" className="text-zinc-300">
                Company name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="account-company"
                autoComplete="organization"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Company Name Pty Ltd"
                {...form.register("company")}
              />
              {form.formState.errors.company ? (
                <p className="text-xs leading-tight text-destructive">
                  {form.formState.errors.company.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-company-phone" className="text-zinc-300">
                Company phone
              </Label>
              <Input
                id="account-company-phone"
                type="tel"
                autoComplete="off"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="+61 400 000 000"
                {...form.register("companyPhone")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-company-email" className="text-zinc-300">
                Company email
              </Label>
              <Input
                id="account-company-email"
                type="email"
                autoComplete="off"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="info@company.com"
                {...form.register("companyEmail")}
              />
              {form.formState.errors.companyEmail ? (
                <p className="text-xs leading-tight text-destructive">
                  {form.formState.errors.companyEmail.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="account-company-website" className="text-zinc-300">
                Company website
              </Label>
              <Input
                id="account-company-website"
                autoComplete="off"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="https://www.company.com"
                {...form.register("companyWebsite")}
              />
              {form.formState.errors.companyWebsite ? (
                <p className="text-xs leading-tight text-destructive">
                  {form.formState.errors.companyWebsite.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300">Company address</Label>
            <Input
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
              placeholder="Line 1"
              {...form.register("companyAddressLine1")}
            />
            <Input
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
              placeholder="Line 2"
              {...form.register("companyAddressLine2")}
            />
            <div className="grid gap-1.5 sm:grid-cols-2">
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="City"
                {...form.register("companyCity")}
              />
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="State / region"
                {...form.register("companyRegion")}
              />
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Postal code"
                {...form.register("companyPostalCode")}
              />
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Country"
                {...form.register("companyCountry")}
              />
            </div>
          </div>

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
