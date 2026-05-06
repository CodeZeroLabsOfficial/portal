"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { updateAccountFormSchema, type UpdateAccountFormInput } from "@/lib/schemas/account";
import { updateAccountAction } from "@/server/actions/accounts-crm";
import type { AccountDetailAggregate } from "@/server/firestore/crm-customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function accountToFormDefaults(account: AccountDetailAggregate, accountKey: string): UpdateAccountFormInput {
  return {
    accountKey,
    company: account.displayName,
    companyPhone: account.companyPhone ?? "",
    companyEmail: account.companyEmail ?? "",
    companyWebsite: account.companyWebsite ?? "",
    companyAddressLine1: account.companyAddressLine1 ?? "",
    companyAddressLine2: account.companyAddressLine2 ?? "",
    companyCity: account.companyCity ?? "",
    companyRegion: account.companyRegion ?? "",
    companyPostalCode: account.companyPostalCode ?? "",
    companyCountry: account.companyCountry ?? "",
  };
}

export interface EditAccountFormProps {
  account: AccountDetailAggregate;
  accountKey: string;
}

export function EditAccountForm({ account, accountKey }: EditAccountFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<UpdateAccountFormInput>({
    resolver: zodResolver(updateAccountFormSchema),
    defaultValues: accountToFormDefaults(account, accountKey),
  });

  React.useEffect(() => {
    form.reset(accountToFormDefaults(account, accountKey));
    setServerError(null);
  }, [account, accountKey, form]);

  async function onSubmit(values: UpdateAccountFormInput) {
    setServerError(null);
    const payload: UpdateAccountFormInput = { ...values, accountKey };
    const result = await updateAccountAction(payload);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    router.push(`/admin/accounts/${result.newAccountKey}`);
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href={`/admin/accounts/${accountKey}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to account
          </Link>
        </Button>
      </div>

      <motion.div className="w-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="w-full overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="text-xl">Edit account</CardTitle>
            <CardDescription>
              Updates company name, address, and company contact fields on every CRM profile linked to this account (
              {account.contacts.length} contact{account.contacts.length === 1 ? "" : "s"}).
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
                  <Label htmlFor="edit-account-company">
                    Company name <span className="text-destructive">*</span>
                  </Label>
                  <Input id="edit-account-company" placeholder="Company Name Pty Ltd" {...form.register("company")} />
                  {form.formState.errors.company ? (
                    <p className="text-xs text-destructive">{form.formState.errors.company.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-account-company-phone">Company phone</Label>
                  <Input id="edit-account-company-phone" type="tel" placeholder="+61 400 000 000" {...form.register("companyPhone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-account-company-email">Company email</Label>
                  <Input
                    id="edit-account-company-email"
                    type="email"
                    autoComplete="off"
                    placeholder="info@company.com"
                    {...form.register("companyEmail")}
                  />
                  {form.formState.errors.companyEmail ? (
                    <p className="text-xs text-destructive">{form.formState.errors.companyEmail.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-account-company-website">Company website</Label>
                  <Input id="edit-account-company-website" placeholder="https://www.company.com" {...form.register("companyWebsite")} />
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

              <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => router.push(`/admin/accounts/${accountKey}`)}
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
