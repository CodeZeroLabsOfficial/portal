"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendPasswordResetEmail } from "firebase/auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseClientAuth } from "@/lib/firebase/client-app";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type InputValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const form = useForm<InputValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function handleSubmit(values: InputValues) {
    setError(null);
    setInfo(null);

    const auth = getFirebaseClientAuth();
    if (!auth) {
      setError(
        "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* keys from .env.example, then restart the dev server.",
      );
      return;
    }

    try {
      await sendPasswordResetEmail(auth, values.email);
      setInfo("Check your email for a link to reset your password.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          {...form.register("email")}
          required
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="text-sm text-muted-foreground" role="status">
          {info}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/login" className="underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
