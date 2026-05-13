"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  proposalPublicSubscriptionModalSchema,
  type ProposalPublicSubscriptionModalInput,
} from "@/lib/schemas/proposal-public-subscription";
import { createProposalPublicSubscriptionAction } from "@/server/actions/proposal-public-subscription";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormServerError } from "@/components/ui/form-server-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebasePublicConfig } from "@/lib/env/client-public";
import type { ProposalPublicSubscriptionUi } from "@/server/proposal/public-proposal-subscription-ui";
import { toast } from "sonner";

interface StripeCardElement {
  mount: (selector: string | Element) => void;
  destroy: () => void;
}
interface StripeElementsInstance {
  create: (type: "card", options?: Record<string, unknown>) => StripeCardElement;
}
interface StripeSetupIntentResult {
  setupIntent?: { payment_method?: string | null };
  error?: { message?: string };
}
interface StripeInstance {
  elements: () => StripeElementsInstance;
  confirmCardSetup: (
    clientSecret: string,
    data: { payment_method: { card: StripeCardElement; billing_details?: { name?: string } } },
  ) => Promise<StripeSetupIntentResult>;
}
declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance;
  }
}

interface SavedCardOption {
  id: string;
  summary: string;
}

export interface ProposalPublicSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string;
  ui: ProposalPublicSubscriptionUi;
}

export function ProposalPublicSubscriptionModal({
  open,
  onOpenChange,
  shareToken,
  ui,
}: ProposalPublicSubscriptionModalProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [cardError, setCardError] = React.useState<string | null>(null);
  const [cardReady, setCardReady] = React.useState(false);
  const [cardSaving, setCardSaving] = React.useState(false);
  const [cardLoading, setCardLoading] = React.useState(false);
  const [cardholderName, setCardholderName] = React.useState("");
  const [savedCards, setSavedCards] = React.useState<SavedCardOption[]>([]);
  const [showAddCard, setShowAddCard] = React.useState(false);
  const stripeRef = React.useRef<StripeInstance | null>(null);
  const cardRef = React.useRef<StripeCardElement | null>(null);

  const form = useForm<ProposalPublicSubscriptionModalInput>({
    resolver: zodResolver(proposalPublicSubscriptionModalSchema),
    defaultValues: {
      collectionMethod: "charge_automatically",
      daysUntilDue: 14,
      defaultPaymentMethodId: undefined,
    },
  });

  const collectionMethod = form.watch("collectionMethod");
  const effectivePmId = form.watch("defaultPaymentMethodId");
  const publishableKey = getFirebasePublicConfig()?.stripePublishableKey?.trim();

  React.useEffect(() => {
    if (!open) {
      form.reset({
        collectionMethod: "charge_automatically",
        daysUntilDue: 14,
        defaultPaymentMethodId: undefined,
      });
      setServerError(null);
      setCardError(null);
      setCardReady(false);
      setCardLoading(false);
      setCardholderName("");
      setSavedCards([]);
      setShowAddCard(false);
      if (cardRef.current) {
        cardRef.current.destroy();
        cardRef.current = null;
      }
    }
  }, [open, form]);

  React.useEffect(() => {
    if (!open || collectionMethod !== "charge_automatically") return;
    let cancelled = false;
    async function loadExistingPaymentMethod() {
      setCardLoading(true);
      setCardError(null);
      try {
        const res = await fetch(
          `/api/public/proposal-stripe-setup-intent?shareToken=${encodeURIComponent(shareToken)}&customerId=${encodeURIComponent(ui.customerId)}`,
          { method: "GET" },
        );
        const data = (await res.json()) as {
          defaultPaymentMethodId?: string | null;
          cards?: SavedCardOption[];
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) setCardError(data.error ?? "Could not load existing card.");
          return;
        }
        if (cancelled) return;
        const pmId = data.defaultPaymentMethodId?.trim() || undefined;
        form.setValue("defaultPaymentMethodId", pmId, { shouldDirty: false, shouldValidate: true });
        setSavedCards(Array.isArray(data.cards) ? data.cards : []);
        setShowAddCard(!pmId);
      } catch (error) {
        if (!cancelled) {
          setCardError(error instanceof Error ? error.message : "Could not load existing card.");
        }
      } finally {
        if (!cancelled) setCardLoading(false);
      }
    }
    void loadExistingPaymentMethod();
    return () => {
      cancelled = true;
    };
  }, [open, collectionMethod, ui.customerId, form]);

  React.useEffect(() => {
    if (collectionMethod !== "charge_automatically" || !open || !showAddCard) return;
    if (!publishableKey) return;
    const key = publishableKey;
    let cancelled = false;
    async function mountCardElement() {
      if (cardRef.current) return;
      const mountTarget = document.getElementById("proposal-public-subscription-card-element");
      if (!mountTarget) return;
      if (!window.Stripe) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[src="https://js.stripe.com/v3/"]');
          if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("Stripe.js failed to load.")), {
              once: true,
            });
            return;
          }
          const script = document.createElement("script");
          script.src = "https://js.stripe.com/v3/";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Stripe.js failed to load."));
          document.head.appendChild(script);
        });
      }
      if (cancelled) return;
      if (!window.Stripe) {
        setCardError("Stripe.js is unavailable.");
        return;
      }
      stripeRef.current = window.Stripe(key);
      const elements = stripeRef.current.elements();
      const card = elements.create("card", {
        style: {
          base: {
            color: "#18181b",
            "::placeholder": { color: "#71717a" },
          },
        },
      });
      card.mount(mountTarget);
      cardRef.current = card;
      setCardReady(true);
    }
    void mountCardElement().catch((e) => {
      const message = e instanceof Error ? e.message : "Could not initialise card entry.";
      if (!message.includes("#proposal-public-subscription-card-element")) setCardError(message);
    });
    return () => {
      cancelled = true;
    };
  }, [collectionMethod, open, publishableKey, showAddCard]);

  React.useEffect(() => {
    if (showAddCard) return;
    if (cardRef.current) {
      cardRef.current.destroy();
      cardRef.current = null;
    }
    setCardReady(false);
  }, [showAddCard]);

  async function saveCardPaymentMethod() {
    setCardError(null);
    if (!stripeRef.current || !cardRef.current) {
      setCardError("Card input is not ready yet.");
      return;
    }
    setCardSaving(true);
    try {
      const res = await fetch("/api/public/proposal-stripe-setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken, customerId: ui.customerId }),
      });
      const data = (await res.json()) as { clientSecret?: string; error?: string };
      if (!res.ok || !data.clientSecret) {
        setCardError(data.error ?? "Could not start card setup.");
        return;
      }
      const result = await stripeRef.current.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: cardRef.current,
          billing_details: { name: cardholderName.trim() || undefined },
        },
      });
      if (result.error?.message) {
        setCardError(result.error.message);
        return;
      }
      const pmId = result.setupIntent?.payment_method;
      if (!pmId || typeof pmId !== "string") {
        setCardError("Card setup completed but no payment method id was returned.");
        return;
      }
      form.setValue("defaultPaymentMethodId", pmId, { shouldValidate: true, shouldDirty: true });
      const res2 = await fetch(
        `/api/public/proposal-stripe-setup-intent?shareToken=${encodeURIComponent(shareToken)}&customerId=${encodeURIComponent(ui.customerId)}`,
        { method: "GET" },
      );
      const data2 = (await res2.json()) as { cards?: SavedCardOption[] };
      if (res2.ok && Array.isArray(data2.cards)) {
        setSavedCards(data2.cards);
      }
      setShowAddCard(false);
    } catch (error) {
      setCardError(error instanceof Error ? error.message : "Could not save card details.");
    } finally {
      setCardSaving(false);
    }
  }

  async function onSubmit(values: ProposalPublicSubscriptionModalInput) {
    setServerError(null);
    const result = await createProposalPublicSubscriptionAction({
      shareToken,
      collectionMethod: values.collectionMethod,
      daysUntilDue:
        values.collectionMethod === "send_invoice" ? values.daysUntilDue ?? 14 : undefined,
      defaultPaymentMethodId:
        values.collectionMethod === "charge_automatically"
          ? values.defaultPaymentMethodId?.trim() || undefined
          : undefined,
    });
    if (!result.ok) {
      setServerError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success("Subscription created.");
    onOpenChange(false);
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,760px)] w-[min(100vw-2rem,560px)] max-w-[560px] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">New subscription</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Same billing setup as your portal — prefilled from this proposal.
          </p>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit((v) => void onSubmit(v))} noValidate>
          <FormServerError message={serverError} rounded="lg" />

          <div className="rounded-lg border border-border/80 bg-muted/20 p-3 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Customer</dt>
                <dd className="font-medium text-foreground">{ui.summary.customer}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Product</dt>
                <dd className="font-medium text-foreground">{ui.summary.product}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Duration</dt>
                <dd className="font-medium text-foreground">{ui.summary.duration}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Start date</dt>
                <dd className="font-medium text-foreground">{ui.summary.startsOnLabel} (UTC)</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proposal-public-collection">Collection method</Label>
            <select
              id="proposal-public-collection"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              disabled={busy}
              value={collectionMethod}
              onChange={(e) =>
                form.setValue(
                  "collectionMethod",
                  e.target.value as ProposalPublicSubscriptionModalInput["collectionMethod"],
                  { shouldValidate: true },
                )
              }
            >
              <option value="charge_automatically">Automatic charge</option>
              <option value="send_invoice">Send invoice</option>
            </select>
          </div>

          {collectionMethod === "send_invoice" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proposal-public-due">Days until due</Label>
              <Input
                id="proposal-public-due"
                type="number"
                min={1}
                max={90}
                disabled={busy}
                value={form.watch("daysUntilDue") ?? 14}
                onChange={(e) => form.setValue("daysUntilDue", Number(e.target.value), { shouldValidate: true })}
              />
              {form.formState.errors.daysUntilDue ? (
                <p className="text-xs text-destructive">{form.formState.errors.daysUntilDue.message}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/10 p-3">
              <Label>Credit card details</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={showAddCard ? "__add_new__" : effectivePmId ?? ""}
                disabled={busy || cardLoading}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__add_new__") {
                    setShowAddCard(true);
                    form.setValue("defaultPaymentMethodId", undefined, { shouldValidate: true });
                    return;
                  }
                  setShowAddCard(false);
                  form.setValue("defaultPaymentMethodId", v || undefined, { shouldValidate: true });
                }}
              >
                <option value="">Select card</option>
                {savedCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.summary}
                  </option>
                ))}
                <option value="__add_new__">+ Add another card</option>
              </select>
              {showAddCard ? (
                <>
                  <Input
                    placeholder="Cardholder name"
                    autoComplete="cc-name"
                    disabled={busy || cardSaving}
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                  />
                  <div
                    id="proposal-public-subscription-card-element"
                    className="rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                  />
                </>
              ) : null}
              {!publishableKey ? (
                <p className="text-xs text-destructive">
                  Configure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to collect card details.
                </p>
              ) : null}
              {cardError ? <p className="text-xs text-destructive">{cardError}</p> : null}
              {cardLoading ? <p className="text-xs text-muted-foreground">Checking existing card…</p> : null}
              {showAddCard ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || cardSaving || !cardReady || !publishableKey}
                  onClick={() => void saveCardPaymentMethod()}
                >
                  {cardSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Save card
                </Button>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
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
