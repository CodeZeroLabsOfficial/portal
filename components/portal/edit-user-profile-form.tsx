"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { updateUserProfileSchema, type UpdateUserProfileInput } from "@/lib/schemas/user-profile";
import { updateCurrentUserProfileAction } from "@/server/actions/user-profile";
import type { PortalUser, UserRole } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function roleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "team":
      return "Team";
    default:
      return "Customer";
  }
}

function portalUserToFormDefaults(user: PortalUser): UpdateUserProfileInput {
  return {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    phone: user.phone ?? "",
    website: user.website ?? "",
    dateOfBirth: user.dateOfBirth ?? "",
    addressLine1: user.addressLine1 ?? "",
    addressLine2: user.addressLine2 ?? "",
    city: user.city ?? "",
    region: user.region ?? "",
    postalCode: user.postalCode ?? "",
    country: user.country ?? "",
  };
}

export interface EditUserProfileFormProps {
  user: PortalUser;
}

export function EditUserProfileForm({ user }: EditUserProfileFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<UpdateUserProfileInput>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: portalUserToFormDefaults(user),
  });

  React.useEffect(() => {
    form.reset(portalUserToFormDefaults(user));
    setServerError(null);
  }, [user, form]);

  async function onSubmit(values: UpdateUserProfileInput) {
    setServerError(null);
    const result = await updateCurrentUserProfileAction(values);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    router.push("/admin/settings/profile");
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/settings/profile">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to profile
          </Link>
        </Button>
      </div>

      <motion.div className="w-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="w-full overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="text-xl">Edit profile</CardTitle>
            <CardDescription>Update your name, contact details, and address. Email and role are managed separately.</CardDescription>
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
                <div className="space-y-2">
                  <Label htmlFor="profile-first">First name</Label>
                  <Input id="profile-first" autoComplete="given-name" placeholder="Jane" {...form.register("firstName")} />
                  {form.formState.errors.firstName ? (
                    <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-last">Last name</Label>
                  <Input id="profile-last" autoComplete="family-name" placeholder="Doe" {...form.register("lastName")} />
                  {form.formState.errors.lastName ? (
                    <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input id="profile-email" type="email" value={user.email} disabled className="bg-muted/50" readOnly />
                  <p className="text-xs text-muted-foreground">Email is tied to your sign-in account and cannot be changed here.</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Role</Label>
                  <Input value={roleLabel(user.role)} disabled className="bg-muted/50 capitalize" readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-phone">Phone</Label>
                  <Input id="profile-phone" type="tel" autoComplete="tel" placeholder="+61 …" {...form.register("phone")} />
                  {form.formState.errors.phone ? (
                    <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-website">Website</Label>
                  <Input id="profile-website" autoComplete="url" placeholder="https://example.com" {...form.register("website")} />
                  {form.formState.errors.website ? (
                    <p className="text-xs text-destructive">{form.formState.errors.website.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="profile-dob">Date of birth</Label>
                  <Input id="profile-dob" type="date" {...form.register("dateOfBirth")} />
                  {form.formState.errors.dateOfBirth ? (
                    <p className="text-xs text-destructive">{form.formState.errors.dateOfBirth.message}</p>
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
                  <Link href="/admin/settings/profile">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
