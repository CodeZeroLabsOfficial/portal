"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

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
  customFields: [],
  linkAuthByEmail: false,
  saveAsLead: false,
};

export function AddCustomerModal({ open, onOpenChange }: AddCustomerModalProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [customRows, setCustomRows] = React.useState<{ key: string; value: string }[]>([]);

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
      setCustomRows([]);
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
    const customFields = customRows
      .filter((r) => r.key.trim().length > 0)
      .map((r) => ({ key: r.key.trim(), value: r.value }))
      .slice(0, 15);
    const payload = { ...values, tags, customFields };
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
      <DialogContent className="max-h-[min(90vh,800px)] w-[min(100vw-2rem,880px)] max-w-[880px] overflow-y-auto border-white/[0.08] bg-[#141414] p-0 sm:max-w-[880px]">
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">New customer</DialogTitle>
          </DialogHeader>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3 px-6 py-5"
          noValidate
        >
          <AnimatePresence initial={false}>
            {serverError ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {serverError}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="crm-record-type" className="text-zinc-300">
              Record type
            </Label>
            <select
              id="crm-record-type"
              value={form.watch("saveAsLead") ? "lead" : "contact"}
              onChange={(e) =>
                form.setValue("saveAsLead", e.target.value === "lead", {
                  shouldDirty: true,
                })
              }
              disabled={busy}
              className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#141414]"
            >
              <option value="lead">Lead</option>
              <option value="contact">Contact</option>
            </select>
          </div>

          <input type="hidden" {...form.register("name")} />
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-first-name" className="text-zinc-300">
                First name
              </Label>
              <Input
                id="crm-first-name"
                autoComplete="given-name"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
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

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <Label className="text-zinc-300">Contact address</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2 text-xs text-primary hover:text-primary"
                onClick={copyCompanyAddressToContact}
                disabled={busy}
              >
                Copy from above
              </Button>
            </div>
            <Input
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
              placeholder="Line 1"
              {...form.register("addressLine1")}
            />
            <Input
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
              placeholder="Line 2"
              {...form.register("addressLine2")}
            />
            <div className="grid gap-1.5 sm:grid-cols-2">
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="City"
                {...form.register("city")}
              />
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="State / region"
                {...form.register("region")}
              />
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Postal code"
                {...form.register("postalCode")}
              />
              <Input
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Country"
                {...form.register("country")}
              />
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-zinc-300">Custom fields</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-primary"
                onClick={() => setCustomRows((r) => [...r, { key: "", value: "" }].slice(0, 15))}
              >
                Add field
              </Button>
            </div>
            <div className="space-y-1.5">
              {customRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                    placeholder="Key"
                    value={row.key}
                    onChange={(e) =>
                      setCustomRows((rows) =>
                        rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) =>
                      setCustomRows((rows) =>
                        rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={Boolean(form.watch("linkAuthByEmail"))}
              onChange={(e) => form.setValue("linkAuthByEmail", e.target.checked, { shouldDirty: true })}
            />
            <span className="text-sm leading-snug text-zinc-300">
              <span className="font-medium text-white">Create user account</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Allow user access to the customer portal to manage subscriptions, billing and payment methods.
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
