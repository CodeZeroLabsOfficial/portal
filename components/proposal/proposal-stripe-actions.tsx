"use client";

import { Loader2, Receipt, ShoppingCart } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";

export interface ProposalStripeActionsProps {
  proposalId: string;
  stripeReady: boolean;
  customerLinked: boolean;
  /** When set, enables subscription Checkout without prompting for a raw Price id. */
  defaultSubscriptionPriceId?: string | null;
}

export function ProposalStripeActions({
  proposalId,
  stripeReady,
  customerLinked,
  defaultSubscriptionPriceId,
}: ProposalStripeActionsProps) {
  const [invoicePending, setInvoicePending] = React.useState(false);
  const [checkoutPending, setCheckoutPending] = React.useState(false);
  const [subPending, setSubPending] = React.useState(false);

  const blocked = !stripeReady || !customerLinked;

  async function createInvoice() {
    if (blocked || invoicePending) return;
    setInvoicePending(true);
    try {
      const res = await fetch("/api/stripe/proposal-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      });
      const data = (await res.json()) as { hostedInvoiceUrl?: string | null; error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "Could not create invoice.");
        return;
      }
      if (data.hostedInvoiceUrl) {
        window.open(data.hostedInvoiceUrl, "_blank", "noopener,noreferrer");
      } else {
        window.alert("Invoice created — open it from Stripe Dashboard or wait for webhook mirror.");
      }
    } finally {
      setInvoicePending(false);
    }
  }

  async function startCheckout(mode: "payment" | "subscription") {
    if (blocked || checkoutPending || subPending) return;
    let subscriptionPriceId: string | undefined;
    if (mode === "subscription") {
      subscriptionPriceId =
        defaultSubscriptionPriceId?.trim() || window.prompt("Stripe Price id (price_…)", "")?.trim();
      if (!subscriptionPriceId) return;
    }

    if (mode === "payment") setCheckoutPending(true);
    else setSubPending(true);
    try {
      const res = await fetch("/api/stripe/proposal-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, mode, subscriptionPriceId }),
      });
      const data = (await res.json()) as { url?: string | null; error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "Could not start checkout.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setCheckoutPending(false);
      setSubPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111118] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Stripe billing</p>
      <p className="mt-1 text-sm text-zinc-400">
        One-click flows use CRM contact email and proposal totals (pricing blocks + accepted package selections).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={blocked || invoicePending}
          onClick={() => void createInvoice()}
          className="gap-2 bg-white text-black hover:bg-zinc-200"
        >
          {invoicePending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Receipt className="h-4 w-4" aria-hidden />}
          Create invoice
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={blocked || checkoutPending}
          onClick={() => void startCheckout("payment")}
          className="gap-2 border-white/[0.12] bg-transparent text-white hover:bg-white/[0.06]"
        >
          {checkoutPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShoppingCart className="h-4 w-4" aria-hidden />}
          Checkout (pay once)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={blocked || subPending}
          onClick={() => void startCheckout("subscription")}
          className="gap-2 border-white/[0.12] bg-transparent text-white hover:bg-white/[0.06]"
        >
          {subPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShoppingCart className="h-4 w-4" aria-hidden />}
          Checkout (subscription)
        </Button>
      </div>
      {blocked ? (
        <p className="mt-3 text-xs text-amber-400/90">
          {!stripeReady
            ? "Configure Stripe API keys on the server."
            : "Link this proposal to a CRM customer to bill a Stripe Customer."}
        </p>
      ) : null}
    </div>
  );
}
