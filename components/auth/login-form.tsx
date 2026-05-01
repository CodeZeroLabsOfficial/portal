"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseClientAuth } from "@/lib/firebase/client-app";

interface LoginFormProps {
  nextPath: string;
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginInput = z.infer<typeof loginSchema>;

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function handleSubmit(values: LoginInput) {
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
      const credential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const idToken = await credential.user.getIdToken(true);

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Unable to create server session.");
      }

      setInfo("Signed in successfully. Redirecting...");
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign in failed.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...form.register("email")}
          required
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
          required
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
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
        {form.formState.isSubmitting ? "Signing in..." : "Continue"}
      </Button>
    </form>
  );
}
