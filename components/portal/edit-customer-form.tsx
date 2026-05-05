"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { updateCustomerFormSchema, type UpdateCustomerFormInput } from "@/lib/schemas/customer";
import { updateCustomerAction } from "@/server/actions/customers-crm";
import type { CustomerRecord } from "@/types/customer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function customerToFormDefaults(customer: CustomerRecord): UpdateCustomerFormInput {
  const customFields = Object.entries(customer.customFields)
    .filter(([k]) => k.trim().length > 0)
    .map(([key, value]) => ({ key, value }));
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    company: customer.company ?? "",
    companyPhone: customer.companyPhone ?? "",
    companyEmail: customer.companyEmail ?? "",
    companyWebsite: customer.companyWebsite ?? "",
    companyAddressLine1: customer.companyAddressLine1 ?? "",
    companyAddressLine2: customer.companyAddressLine2 ?? "",
    companyCity: customer.companyCity ?? "",
    companyRegion: customer.companyRegion ?? "",
    companyPostalCode: customer.companyPostalCode ?? "",
    companyCountry: customer.companyCountry ?? "",
    phone: customer.phone ?? "",
    addressLine1: customer.addressLine1 ?? "",
    addressLine2: customer.addressLine2 ?? "",
    city: customer.city ?? "",
    region: customer.region ?? "",
    postalCode: customer.postalCode ?? "",
    country: customer.country ?? "",
    tags: customer.tags,
    customFields,
    linkAuthByEmail: Boolean(customer.portalUserId),
  };
}

export interface EditCustomerFormProps {
  customer: CustomerRecord;
}

export function EditCustomerForm({ customer }: EditCustomerFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [tagInput, setTagInput] = React.useState(() => customer.tags.join(", "));
  const [customRows, setCustomRows] = React.useState<{ key: string; value: string }[]>(() =>
    Object.entries(customer.customFields)
      .filter(([k]) => k.trim().length > 0)
      .map(([key, value]) => ({ key, value })),
  );

  const form = useForm<UpdateCustomerFormInput>({
    resolver: zodResolver(updateCustomerFormSchema),
    defaultValues: customerToFormDefaults(customer),
  });

  React.useEffect(() => {
    form.reset(customerToFormDefaults(customer));
    setTagInput(customer.tags.join(", "));
    setCustomRows(
      Object.entries(customer.customFields)
        .filter(([k]) => k.trim().length > 0)
        .map(([key, value]) => ({ key, value })),
    );
    setServerError(null);
  }, [customer, form]);

  async function onSubmit(values: UpdateCustomerFormInput) {
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
    const payload: UpdateCustomerFormInput = { ...values, id: customer.id, tags, customFields };
    const result = await updateCustomerAction(payload);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    router.push(`/admin/customers/${customer.id}`);
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href={`/admin/customers/${customer.id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to profile
          </Link>
        </Button>
      </div>

      <motion.div className="w-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="w-full overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="text-xl">Edit customer</CardTitle>
            <CardDescription>
              Update contact details, company profile, address, tags, and custom fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <AnimatePresence initial={false}>
                {serverError ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    role="alert"
                  >
                    {serverError}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-crm-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input id="edit-crm-name" autoComplete="name" placeholder="Jane Doe" {...form.register("name")} />
                  {form.formState.errors.name ? (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-crm-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-crm-email"
                    type="email"
                    autoComplete="email"
                    placeholder="jane@company.com"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email ? (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-crm-company">Company name</Label>
                  <Input id="edit-crm-company" placeholder="Acme Pty Ltd" {...form.register("company")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-crm-company-phone">Company phone</Label>
                  <Input id="edit-crm-company-phone" type="tel" placeholder="+61 …" {...form.register("companyPhone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-crm-company-email">Company email</Label>
                  <Input
                    id="edit-crm-company-email"
                    type="email"
                    autoComplete="off"
                    placeholder="hello@acme.com"
                    {...form.register("companyEmail")}
                  />
                  {form.formState.errors.companyEmail ? (
                    <p className="text-xs text-destructive">{form.formState.errors.companyEmail.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-crm-company-website">Company website</Label>
                  <Input id="edit-crm-company-website" placeholder="https://acme.com" {...form.register("companyWebsite")} />
                  {form.formState.errors.companyWebsite ? (
                    <p className="text-xs text-destructive">{form.formState.errors.companyWebsite.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Company address</Label>
                <Input placeholder="Line 1" {...form.register("companyAddressLine1")} />
                <Input placeholder="Line 2" {...form.register("companyAddressLine2")} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="City" {...form.register("companyCity")} />
                  <Input placeholder="State / region" {...form.register("companyRegion")} />
                  <Input placeholder="Postal code" {...form.register("companyPostalCode")} />
                  <Input placeholder="Country" {...form.register("companyCountry")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-crm-phone">Contact phone</Label>
                <Input id="edit-crm-phone" type="tel" placeholder="+61 …" {...form.register("phone")} />
              </div>

              <div className="space-y-2">
                <Label>Contact address</Label>
                <Input placeholder="Line 1" {...form.register("addressLine1")} />
                <Input placeholder="Line 2" {...form.register("addressLine2")} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="City" {...form.register("city")} />
                  <Input placeholder="State / region" {...form.register("region")} />
                  <Input placeholder="Postal code" {...form.register("postalCode")} />
                  <Input placeholder="Country" {...form.register("country")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-crm-tags">Tags</Label>
                <Input
                  id="edit-crm-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="vip, priority — comma separated"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Custom fields</Label>
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
                        placeholder="Key"
                        value={row.key}
                        onChange={(e) =>
                          setCustomRows((rows) =>
                            rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)),
                          )
                        }
                      />
                      <Input
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

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/30">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={Boolean(form.watch("linkAuthByEmail"))}
                  onChange={(e) => form.setValue("linkAuthByEmail", e.target.checked, { shouldDirty: true })}
                />
                <span className="text-sm leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground">Link Firebase Auth</span>
                  <span className="mt-0.5 block text-xs">
                    If a user exists with this email, store their UID for portal features.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => router.push(`/admin/customers/${customer.id}`)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="min-w-[7rem] gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
