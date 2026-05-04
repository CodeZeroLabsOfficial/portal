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
  DialogDescription,
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
  const [tagInput, setTagInput] = React.useState("");
  const [customRows, setCustomRows] = React.useState<{ key: string; value: string }[]>([]);

  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setTagInput("");
      setCustomRows([]);
      setServerError(null);
    }
  }, [open, form]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto border-white/[0.08] bg-[#141414] p-0 sm:max-w-lg">
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">New customer</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-zinc-400">
              Create a CRM profile for your organisation. Optionally link an existing Firebase Auth user by email.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 px-6 py-5"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="crm-name" className="text-zinc-300">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="crm-name"
                autoComplete="name"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Jane Doe"
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="crm-email" className="text-zinc-300">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="crm-email"
                type="email"
                autoComplete="email"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="jane@company.com"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-company" className="text-zinc-300">
                Company
              </Label>
              <Input
                id="crm-company"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="Acme Pty Ltd"
                {...form.register("company")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-phone" className="text-zinc-300">
                Phone
              </Label>
              <Input
                id="crm-phone"
                type="tel"
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                placeholder="+61 …"
                {...form.register("phone")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Address</Label>
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
            <div className="grid gap-2 sm:grid-cols-2">
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

          <div className="space-y-2">
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

          <div className="space-y-2">
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
            <div className="space-y-2">
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
              checked={Boolean(form.watch("saveAsLead"))}
              onChange={(e) => form.setValue("saveAsLead", e.target.checked, { shouldDirty: true })}
            />
            <span className="text-sm leading-snug text-zinc-300">
              <span className="font-medium text-white">Save as lead</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Leads use the same customer record; convert to a contact when you attach a real pipeline opportunity.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={Boolean(form.watch("linkAuthByEmail"))}
              onChange={(e) => form.setValue("linkAuthByEmail", e.target.checked, { shouldDirty: true })}
            />
            <span className="text-sm leading-snug text-zinc-300">
              <span className="font-medium text-white">Link Firebase Auth</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                If a user already exists with this email, their UID is stored on the customer for portal features.
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
