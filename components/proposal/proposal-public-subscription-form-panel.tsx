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
import { FormServerError } from "@/components/ui/form-server-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebasePublicConfig } from "@/lib/env/client-public";
import { formatCurrencyAmount } from "@/lib/format";
import type { ProposalPublicSubscriptionUi } from "@/server/proposal/public-proposal-subscription-ui";
import { cn } from "@/lib/utils";
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

export interface ProposalPublicSubscriptionFormPanelProps {
  shareToken: string;
  ui: ProposalPublicSubscriptionUi;
  /** When false, effects skip work and card element is torn down (e.g. accordion collapsed). */
  active: boolean;
  /** DOM id for the Stripe Card element mount target (must be unique per mounted instance). */
  cardElementId: string;
  /** `save_card_only`: collect card before acceptance. `manage_subscription`: full create flow. */
  mode: "save_card_only" | "manage_subscription";
  /** Shown in save_card_only header as “Monthly total”. */
  monthlyTotalMinor?: number;
  monthlyCurrency?: string;
  onCardSaved?: () => void;
  /** Fires when the effective saved-card summary changes (for collapsed accordion labels). */
  onPaymentSummaryChange?: (summary: string | null) => void;
  /** Matches agreement “Agree” / primary actions (e.g. block CTA colour). */
  primaryCtaColor?: string;
  primaryCtaForeground?: string;
  className?: string;
}

export function ProposalPublicSubscriptionFormPanel({
  shareToken,
  ui,
  active,
  cardElementId,
  mode,
  monthlyTotalMinor,
  monthlyCurrency,
  onCardSaved,
  onPaymentSummaryChange,
  primaryCtaColor,
  primaryCtaForeground,
  className,
}: ProposalPublicSubscriptionFormPanelProps) {
  const saveCardBg = primaryCtaColor?.trim() || "#1a1a5e";
  const saveCardFg = primaryCtaForeground?.trim() || "#ffffff";
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [cardError, setCardError] = React.useState<string | null>(null);
  const [cardReady, setCardReady] = React.useState(false);
  const [cardSaving, setCardSaving] = React.useState(false);
  const [cardLoading, setCardLoading] = React.useState(false);
  const [cardholderName, setCardholderName] = React.useState("");
  const [savedCards, setSavedCards] = React.useState<SavedCardOption[]>([]);
  const [showAddCard, setShowAddCard] = React.useState(false);
  const [defaultPmSummary, setDefaultPmSummary] = React.useState<string | null>(null);
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
    if (!active) {
      setServerError(null);
      setCardError(null);
      setCardReady(false);
      setCardLoading(false);
      setCardholderName("");
      setSavedCards([]);
      setShowAddCard(false);
      setDefaultPmSummary(null);
      if (cardRef.current) {
        cardRef.current.destroy();
        cardRef.current = null;
      }
      stripeRef.current = null;
      form.reset({
        collectionMethod: "charge_automatically",
        daysUntilDue: 14,
        defaultPaymentMethodId: undefined,
      });
    }
  }, [active, form]);

  React.useEffect(() => {
    if (!active || collectionMethod !== "charge_automatically") return;
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
          defaultPaymentMethodSummary?: string | null;
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
        const sum =
          typeof data.defaultPaymentMethodSummary === "string" && data.defaultPaymentMethodSummary.trim()
            ? data.defaultPaymentMethodSummary.trim()
            : null;
        setDefaultPmSummary(sum);
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
  }, [active, collectionMethod, shareToken, ui.customerId, form]);

  React.useEffect(() => {
    if (collectionMethod !== "charge_automatically" || !active || !showAddCard) return;
    if (!publishableKey) return;
    const key = publishableKey;
    let cancelled = false;
    async function mountCardElement() {
      if (cardRef.current) return;
      const mountTarget = document.getElementById(cardElementId);
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
      if (!message.includes(cardElementId)) setCardError(message);
    });
    return () => {
      cancelled = true;
    };
  }, [collectionMethod, active, publishableKey, showAddCard, cardElementId]);

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
      const data2 = (await res2.json()) as {
        cards?: SavedCardOption[];
        defaultPaymentMethodSummary?: string | null;
      };
      if (res2.ok && Array.isArray(data2.cards)) {
        setSavedCards(data2.cards);
      }
      if (res2.ok && typeof data2.defaultPaymentMethodSummary === "string" && data2.defaultPaymentMethodSummary.trim()) {
        setDefaultPmSummary(data2.defaultPaymentMethodSummary.trim());
      }
      setShowAddCard(false);
      onCardSaved?.();
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
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  const cardSummary =
    !showAddCard && effectivePmId
      ? savedCards.find((c) => c.id === effectivePmId)?.summary ?? defaultPmSummary
      : null;

  React.useEffect(() => {
    if (!active) return;
    onPaymentSummaryChange?.(cardSummary);
  }, [active, cardSummary, onPaymentSummaryChange]);

  if (!active) return null;

  return (
    <div className={cn("space-y-5", className)}>
      {mode === "save_card_only" &&
      typeof monthlyTotalMinor === "number" &&
      Number.isFinite(monthlyTotalMinor) &&
      monthlyCurrency ? (
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-4">
          <span className="text-sm font-semibold text-[#1a1a5e]">Monthly total</span>
          <span className="text-lg font-semibold tabular-nums text-[#1a1a5e]">
            {formatCurrencyAmount(monthlyTotalMinor, monthlyCurrency)}
          </span>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={form.handleSubmit((v) => void onSubmit(v))} noValidate>
        <FormServerError message={serverError} rounded="lg" />

        {mode === "manage_subscription" ? (
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
        ) : (
          <div>
            <h4 className="text-lg font-semibold tracking-tight text-[#1a1a5e]">Payment details</h4>
            <p className="mt-1 text-sm text-slate-600">
              Card is saved securely via Stripe. You can start the subscription after you sign the agreement.
            </p>
          </div>
        )}

        {mode === "manage_subscription" ? (
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
        ) : null}

        {collectionMethod === "send_invoice" && mode === "manage_subscription" ? (
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
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Label className="text-sm font-medium text-[#1a1a5e]">
              {mode === "save_card_only" ? "Payment method" : "Credit card details"}
            </Label>
            <select
              className="flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm"
              aria-label="Saved payment methods"
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
              <option value="__add_new__">+ Add new card</option>
            </select>
            {showAddCard ? (
              <div className="space-y-3 pt-1">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="proposal-inline-cardholder" className="text-sm font-medium text-[#1a1a5e]">
                      Name on card
                    </Label>
                    <Input
                      id="proposal-inline-cardholder"
                      placeholder="Full name on card"
                      autoComplete="cc-name"
                      disabled={busy || cardSaving}
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      className="h-11 rounded-lg border-slate-200"
                    />
                  </div>
                </div>
                <div
                  id={cardElementId}
                  className="min-h-[52px] rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"
                />
              </div>
            ) : null}
            {!publishableKey ? (
              <p className="text-xs text-destructive">
                Configure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to collect card details.
              </p>
            ) : null}
            {cardError ? <p className="text-xs text-destructive">{cardError}</p> : null}
            {cardLoading ? <p className="text-xs text-muted-foreground">Checking saved cards…</p> : null}
            {mode === "save_card_only" && cardSummary && !showAddCard ? (
              <p className="text-sm font-medium text-slate-700">Using: {cardSummary}</p>
            ) : null}
          </div>
        )}

        {mode === "save_card_only" ? (
          <p className="text-xs leading-relaxed text-slate-500">
            By providing your card information, you allow us to charge your card for future payments in accordance with
            the agreement and applicable terms.
          </p>
        ) : null}

        {mode === "manage_subscription" ? (
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {showAddCard && collectionMethod === "charge_automatically" ? (
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 rounded-md px-3 font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: saveCardBg, color: saveCardFg }}
                disabled={busy || cardSaving || !cardReady || !publishableKey}
                onClick={() => void saveCardPaymentMethod()}
              >
                {cardSaving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
                Save card
              </Button>
            ) : null}
            <Button type="submit" disabled={busy} className="min-w-[7rem] gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Start subscription
            </Button>
          </div>
        ) : showAddCard && collectionMethod === "charge_automatically" ? (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 rounded-md px-3 font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: saveCardBg, color: saveCardFg }}
              disabled={busy || cardSaving || !cardReady || !publishableKey}
              onClick={() => void saveCardPaymentMethod()}
            >
              {cardSaving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              Save card
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
