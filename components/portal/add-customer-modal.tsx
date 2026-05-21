"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { createCustomerSchema, type CreateCustomerInput } from "@/lib/schemas/customer";
import { createCustomerAction } from "@/server/actions/customers-crm";
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
import { useRouter } from "next/navigation";
import { normalizeAddressFields } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WORKSPACE_GLASS_DIALOG_SURFACE_CLASSES } from "@/lib/workspace-glass";

interface AddCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultValues: CreateCustomerInput = {
  name: "",
  email: "",
  company: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  companyAbn: "",
  companyAcn: "",
  companyAddressLine1: "",
  companyAddressLine2: "",
  companyCity: "",
  companyRegion: "",
  companyPostalCode: "",
  companyCountry: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  tags: [],
  saveAsLead: false,
};

export function AddCustomerModal({ open, onOpenChange }: AddCustomerModalProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");

  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setFirstName("");
      setLastName("");
      setTagInput("");
      setServerError(null);
    }
  }, [open, form]);

  React.useEffect(() => {
    const combined = [firstName, lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")
      .trim();
    form.setValue("name", combined, { shouldValidate: true, shouldDirty: false });
  }, [firstName, lastName, form]);

  async function onSubmit(values: CreateCustomerInput) {
    setServerError(null);
    const tags = tagInput
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    const contactAddress = normalizeAddressFields({
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2,
      city: values.city,
      region: values.region,
      postalCode: values.postalCode,
      country: values.country,
    });
    const payload = {
      ...values,
      ...contactAddress,
      tags,
    };
    const result = await createCustomerAction(payload);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    onOpenChange(false);
    router.push(`/admin/customers/${result.customerId}`);
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  function copyCompanyAddressToContact() {
    const v = form.getValues();
    const opts = { shouldDirty: true, shouldTouch: true };
    form.setValue("addressLine1", v.companyAddressLine1 ?? "", opts);
    form.setValue("addressLine2", v.companyAddressLine2 ?? "", opts);
    form.setValue("city", v.companyCity ?? "", opts);
    form.setValue("region", v.companyRegion ?? "", opts);
    form.setValue("postalCode", v.companyPostalCode ?? "", opts);
    form.setValue("country", v.companyCountry ?? "", opts);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,900px)] w-[min(100vw-2rem,72rem)] !max-w-[min(100vw-2rem,72rem)] flex-col gap-0 overflow-hidden p-0 sm:!max-w-[min(100vw-2rem,72rem)]",
          WORKSPACE_GLASS_DIALOG_SURFACE_CLASSES,
        )}
      >
        <div className="shrink-0 border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">New customer</DialogTitle>
          </DialogHeader>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          noValidate
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-8 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FormServerError message={serverError} rounded="xl" />

          <input type="hidden" {...form.register("name")} />
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-first-name" className="text-zinc-300">
                First name
              </Label>
              <div className="flex overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.04] focus-within:ring-2 focus-within:ring-ring">
                <div className="relative shrink-0 border-r border-white/[0.08]">
                  <select
                    id="crm-record-type"
                    className="h-9 appearance-none bg-transparent py-1 pl-3 pr-7 text-sm text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
                    value={form.watch("saveAsLead") ? "lead" : "contact"}
                    disabled={busy}
                    aria-label="Record type"
                    onChange={(e) =>
                      form.setValue("saveAsLead", e.target.value === "lead", {
                        shouldDirty: true,
                      })
                    }
                  >
                    <option value="contact">Contact</option>
                    <option value="lead">Lead</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                    aria-hidden
                  />
                </div>
                <Input
                  id="crm-first-name"
                  autoComplete="given-name"
                  className="h-9 flex-1 rounded-none border-0 bg-transparent text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-last-name" className="text-zinc-300">
                Last name
              </Label>
              <Input
                id="crm-last-name"
                autoComplete="family-name"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-company" className="text-zinc-300">
                Company name
              </Label>
              <Input
                id="crm-company"
                autoComplete="organization"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Company Name Pty Ltd"
                {...form.register("company")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-company-email" className="text-zinc-300">
                Company email
              </Label>
              <Input
                id="crm-company-email"
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-email" className="text-zinc-300">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="crm-email"
                type="email"
                autoComplete="email"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="john.smith@company.com"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-xs leading-tight text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-phone" className="text-zinc-300">
                Phone
              </Label>
              <Input
                id="crm-phone"
                type="tel"
                autoComplete="tel"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="+61 400 000 000"
                {...form.register("phone")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-company-phone" className="text-zinc-300">
                Company phone
              </Label>
              <Input
                id="crm-company-phone"
                type="tel"
                autoComplete="off"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="+61 400 000 000"
                {...form.register("companyPhone")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-company-website" className="text-zinc-300">
                Company website
              </Label>
              <Input
                id="crm-company-website"
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-company-abn" className="text-zinc-300">
                ABN
              </Label>
              <Input
                id="crm-company-abn"
                autoComplete="off"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="12 345 678 901"
                {...form.register("companyAbn")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-company-acn" className="text-zinc-300">
                ACN
              </Label>
              <Input
                id="crm-company-acn"
                autoComplete="off"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="123 456 789"
                {...form.register("companyAcn")}
              />
            </div>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <Label className="hidden h-8 content-center text-zinc-300 md:block">Company address</Label>
            <div className="hidden h-8 items-center justify-between gap-2 md:flex">
              <Label className="text-zinc-300">Contact address</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 whitespace-nowrap px-2 text-xs text-primary hover:text-primary"
                onClick={copyCompanyAddressToContact}
                disabled={busy}
              >
                Copy from company
              </Button>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="text-zinc-300 md:hidden">Company address</Label>
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
              <div className="grid min-w-0 grid-cols-2 gap-1.5">
                <Input
                  className="min-w-0 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                  placeholder="City"
                  {...form.register("companyCity")}
                />
                <Input
                  className="min-w-0 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                  placeholder="State / region"
                  {...form.register("companyRegion")}
                />
                <Input
                  className="min-w-0 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                  placeholder="Postal code"
                  {...form.register("companyPostalCode")}
                />
                <Input
                  className="min-w-0 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                  placeholder="Country"
                  {...form.register("companyCountry")}
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 md:hidden">
                <Label className="text-zinc-300">Contact address</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 whitespace-nowrap px-2 text-xs text-primary hover:text-primary"
                  onClick={copyCompanyAddressToContact}
                  disabled={busy}
                >
                  Copy from company
                </Button>
              </div>
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Line 1"
                autoComplete="address-line1"
                {...form.register("addressLine1")}
              />
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Line 2"
                autoComplete="address-line2"
                {...form.register("addressLine2")}
              />
              <div className="grid min-w-0 grid-cols-2 gap-1.5">
                <Input
                  className="min-w-0 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                  placeholder="City"
                  autoComplete="address-level2"
                  {...form.register("city")}
                />
                <Input
                  className="min-w-0 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                  placeholder="State / region"
                  autoComplete="address-level1"
                  {...form.register("region")}
                />
                <Input
                  className="min-w-0 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                  placeholder="Postal code"
                  autoComplete="postal-code"
                  {...form.register("postalCode")}
                />
                <Input
                  className="min-w-0 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                  placeholder="Country"
                  autoComplete="country-name"
                  {...form.register("country")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="crm-tags" className="text-zinc-300">
              Tags
            </Label>
            <Input
              id="crm-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
              placeholder="vip, priority — comma separated"
            />
          </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-white/[0.06] px-8 pb-6 pt-4 sm:justify-end">
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
