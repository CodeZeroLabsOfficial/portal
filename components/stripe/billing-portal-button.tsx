"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";

export interface BillingPortalButtonProps {
  disabled?: boolean;
  className?: string;
}

export function BillingPortalButton({ disabled, className }: BillingPortalButtonProps) {
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    if (disabled || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "Could not open billing portal.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" className={className} disabled={disabled || pending} onClick={() => void onClick()}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
      Manage billing & invoices
    </Button>
  );
}
