"use client";

import { CreditCard, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StripeIntegrationCardProps {
  /** API key + webhook secret present — mirrors will sync. */
  connected: boolean;
}

export function StripeIntegrationCard({ connected }: StripeIntegrationCardProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#14141f] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#635bff]/15 text-[#635bff]">
            <CreditCard className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-white">Stripe</h2>
            <p className="text-sm text-zinc-400">
              Sync customers, subscriptions, invoices, and payments into Firestore via webhooks. Staff can raise
              invoices and Checkout sessions from proposals; customers manage cards and history on your domain through
              the Billing Portal.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-flex h-2 w-2 rounded-full",
                connected ? "bg-emerald-500" : "bg-zinc-500",
              )}
              aria-hidden
            />
            <span className={connected ? "text-emerald-400" : "text-zinc-400"}>
              {connected ? "Connected" : "Not configured"}
            </span>
          </div>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open Stripe Dashboard
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
      {!connected ? (
        <p className="mt-4 text-sm text-zinc-500">
          Add <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-zinc-300">STRIPE_SECRET_KEY</code> and{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-zinc-300">STRIPE_WEBHOOK_SECRET</code> to your
          deployment environment, then register the webhook endpoint below.
        </p>
      ) : null}
    </div>
  );
}
