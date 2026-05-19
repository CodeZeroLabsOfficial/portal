import type Stripe from "stripe";
import type { ProposalStripeOneOffItem } from "@/lib/proposal-commerce";

const STRIPE_MIN_MINOR = 50;

export type ChargeProposalOneOffParams = {
  stripe: Stripe;
  stripeCustomerId: string;
  items: ProposalStripeOneOffItem[];
  organizationId?: string;
  proposalId: string;
  proposalTitle: string;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue?: number;
  defaultPaymentMethodId?: string;
};

export type ChargeProposalOneOffResult =
  | { ok: true; invoiceId: string; hostedInvoiceUrl: string | null }
  | { ok: false; message: string };

function lineAmountMinor(item: ProposalStripeOneOffItem): number | null {
  if (typeof item.amountMinor === "number" && item.quantity > 0) {
    return Math.round(item.amountMinor * item.quantity);
  }
  return null;
}

/**
 * Finalizes a Stripe invoice for one-time proposal charges (upfront fees and
 * one-off catalogue add-ons). Recurring plan/add-on amounts belong on a subscription.
 */
export async function chargeProposalOneOffItems(
  params: ChargeProposalOneOffParams,
): Promise<ChargeProposalOneOffResult> {
  const {
    stripe,
    stripeCustomerId,
    items,
    organizationId,
    proposalId,
    proposalTitle,
    collectionMethod,
    daysUntilDue,
    defaultPaymentMethodId,
  } = params;

  if (items.length === 0) {
    return { ok: false, message: "No one-time charges to invoice." };
  }

  const currency = (items[0]?.currency || "aud").toLowerCase();
  let pendingTotal = 0;

  for (const item of items) {
    if (item.priceId) continue;
    const amt = lineAmountMinor(item);
    if (amt != null) pendingTotal += amt;
  }

  if (pendingTotal > 0 && pendingTotal < STRIPE_MIN_MINOR) {
    return {
      ok: false,
      message: `One-time charges total is below the Stripe minimum (${STRIPE_MIN_MINOR / 100} ${currency.toUpperCase()}).`,
    };
  }

  try {
    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: collectionMethod,
      ...(collectionMethod === "send_invoice" ? { days_until_due: daysUntilDue ?? 14 } : {}),
      ...(collectionMethod === "charge_automatically" && defaultPaymentMethodId
        ? { default_payment_method: defaultPaymentMethodId }
        : {}),
      auto_advance: false,
      metadata: {
        proposal_id: proposalId,
        billing_kind: "proposal_one_off",
        ...(organizationId ? { organization_id: organizationId } : {}),
      },
      description: `One-time charges: ${proposalTitle}`,
    });

    for (const item of items) {
      const qty = Math.max(1, Math.floor(item.quantity));
      if (item.priceId?.trim()) {
        await stripe.invoiceItems.create({
          customer: stripeCustomerId,
          invoice: invoice.id,
          price: item.priceId.trim(),
          quantity: qty,
          description: item.description,
          metadata: { proposal_id: proposalId },
        });
        continue;
      }

      const amount = lineAmountMinor(item);
      if (amount == null || amount < STRIPE_MIN_MINOR) {
        return {
          ok: false,
          message: `Charge “${item.description}” is below the Stripe minimum (${STRIPE_MIN_MINOR / 100} ${currency.toUpperCase()}).`,
        };
      }

      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: invoice.id,
        amount,
        currency: item.currency.toLowerCase(),
        description: item.description,
        metadata: { proposal_id: proposalId },
      });
    }

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id, {
      auto_advance: collectionMethod === "charge_automatically",
    });

    if (collectionMethod === "charge_automatically" && defaultPaymentMethodId) {
      try {
        await stripe.invoices.pay(finalized.id, { payment_method: defaultPaymentMethodId });
      } catch {
        /* Customer may pay via hosted invoice if auto-pay fails */
      }
    }

    return {
      ok: true,
      invoiceId: finalized.id,
      hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create one-time invoice.";
    return { ok: false, message };
  }
}
