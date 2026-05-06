"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { updateCompanySettingsSchema, type UpdateCompanySettingsInput } from "@/lib/schemas/company-settings";
import { updateWorkspaceCompanySettingsAction } from "@/server/actions/company-settings";
import type { WorkspaceCompanySettings } from "@/types/organization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormServerError } from "@/components/ui/form-server-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function settingsToFormDefaults(s: WorkspaceCompanySettings): UpdateCompanySettingsInput {
  return {
    name: s.name,
    phone: s.phone,
    email: s.email,
    website: s.website,
    acn: s.acn,
    abn: s.abn,
    addressLine1: s.addressLine1,
    addressLine2: s.addressLine2,
    city: s.city,
    region: s.region,
    postalCode: s.postalCode,
    country: s.country,
  };
}

export interface EditCompanySettingsFormProps {
  settings: WorkspaceCompanySettings;
}

export function EditCompanySettingsForm({ settings }: EditCompanySettingsFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<UpdateCompanySettingsInput>({
    resolver: zodResolver(updateCompanySettingsSchema),
    defaultValues: settingsToFormDefaults(settings),
  });

  React.useEffect(() => {
    form.reset(settingsToFormDefaults(settings));
    setServerError(null);
  }, [settings, form]);

  async function onSubmit(values: UpdateCompanySettingsInput) {
    setServerError(null);
    const result = await updateWorkspaceCompanySettingsAction(values);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    router.push("/admin/settings/company");
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/settings/company">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to company
          </Link>
        </Button>
      </div>

      <motion.div className="w-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="w-full overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="text-xl">Edit company</CardTitle>
            <CardDescription>
              Update how your organization appears on invoices, proposals, and internal records.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormServerError message={serverError} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="company-name">Company name</Label>
                  <Input id="company-name" autoComplete="organization" placeholder="Company Name Pty Ltd" {...form.register("name")} />
                  {form.formState.errors.name ? (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Phone</Label>
                  <Input id="company-phone" type="tel" autoComplete="tel" placeholder="+61 400 000 000" {...form.register("phone")} />
                  {form.formState.errors.phone ? (
                    <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">Email</Label>
                  <Input id="company-email" type="email" autoComplete="email" placeholder="info@company.com" {...form.register("email")} />
                  {form.formState.errors.email ? (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="company-website">Website</Label>
                  <Input id="company-website" autoComplete="url" placeholder="https://www.company.com" {...form.register("website")} />
                  {form.formState.errors.website ? (
                    <p className="text-xs text-destructive">{form.formState.errors.website.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-acn">ACN</Label>
                  <Input id="company-acn" autoComplete="off" placeholder="123 456 789" {...form.register("acn")} />
                  {form.formState.errors.acn ? (
                    <p className="text-xs text-destructive">{form.formState.errors.acn.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-abn">ABN</Label>
                  <Input id="company-abn" autoComplete="off" placeholder="12 345 678 901" {...form.register("abn")} />
                  {form.formState.errors.abn ? (
                    <p className="text-xs text-destructive">{form.formState.errors.abn.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input placeholder="Line 1" autoComplete="address-line1" {...form.register("addressLine1")} />
                <Input placeholder="Line 2" autoComplete="address-line2" {...form.register("addressLine2")} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="City" autoComplete="address-level2" {...form.register("city")} />
                  <Input placeholder="State / region" autoComplete="address-level1" {...form.register("region")} />
                  <Input placeholder="Postal code" autoComplete="postal-code" {...form.register("postalCode")} />
                  <Input placeholder="Country" autoComplete="country-name" {...form.register("country")} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <Button type="button" variant="outline" disabled={busy} asChild>
                  <Link href="/admin/settings/company">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
