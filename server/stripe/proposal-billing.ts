import type Stripe from "stripe";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import type { CustomerRecord } from "@/types/customer";
import type { PackagesBlock, PricingBlock, ProposalRecord } from "@/types/proposal";

/** Sum line items from pricing blocks and accepted package selections (publicSelections). */
export function computeProposalTotalMinor(proposal: ProposalRecord): number {
  let total = 0;
  const blocks = proposal.document.blocks;

  for (const block of blocks) {
    if (block.type === "pricing") {
      const pb = block as PricingBlock;
      for (const line of pb.lineItems) {
        const qty = line.quantity ?? 1;
        total += line.unitAmountMinor * qty;
      }
    }
  }

  if (proposal.publicSelections) {
    for (const [blockId, sel] of Object.entries(proposal.publicSelections)) {
      if (sel.kind !== "packages") continue;
      const raw = blocks.find((b) => b.id === blockId);
      if (!raw || raw.type !== "packages") continue;
      const pb = raw as PackagesBlock;
      const tier = pb.tiers.find((t) => t.id === sel.tierId);
      if (!tier) continue;
      const months = sel.term === "24_months" ? 24 : 12;
      const monthly =
        sel.term === "24_months" ? tier.monthlyCost24Minor : tier.monthlyCost12Minor;
      total += monthly * months;
    }
  }

  return total;
}

export function resolveProposalCurrency(proposal: ProposalRecord): string {
  for (const b of proposal.document.blocks) {
    if (b.type === "pricing" || b.type === "packages") {
      return b.currency.toLowerCase();
    }
  }
  return DEFAULT_CURRENCY;
}

/**
 * Ensures a Stripe Customer exists for this CRM row and returns its id.
 * Does not persist to Firestore — caller updates `customers/{id}` when the id is newly created.
 */
export async function ensureStripeCustomer(
  stripe: Stripe,
  crm: CustomerRecord,
  organizationId?: string,
): Promise<{ stripeCustomerId: string; created: boolean }> {
  if (crm.stripeCustomerId) {
    await stripe.customers.update(crm.stripeCustomerId, {
      email: crm.email || undefined,
      name: crm.name || undefined,
      metadata: {
        crm_customer_id: crm.id,
        ...(organizationId ? { organization_id: organizationId } : {}),
      },
    });
    return { stripeCustomerId: crm.stripeCustomerId, created: false };
  }

  const created = await stripe.customers.create({
    email: crm.email,
    name: crm.name,
    metadata: {
      crm_customer_id: crm.id,
      ...(organizationId ? { organization_id: organizationId } : {}),
    },
  });

  return { stripeCustomerId: created.id, created: true };
}

export async function createStripeInvoiceForProposal(
  stripe: Stripe,
  proposal: ProposalRecord,
  crm: CustomerRecord,
  organizationId?: string,
): Promise<{ invoiceId: string; hostedInvoiceUrl: string | null; stripeCustomerId: string }> {
  const amount = computeProposalTotalMinor(proposal);
  if (amount < 50) {
    throw new Error(
      "Computed proposal total is below the Stripe minimum (50 minor units). Add pricing or package selections.",
    );
  }

  const currency = resolveProposalCurrency(proposal);
  const { stripeCustomerId } = await ensureStripeCustomer(stripe, crm, organizationId);

  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: "send_invoice",
    days_until_due: 14,
    auto_advance: false,
    metadata: {
      proposal_id: proposal.id,
      ...(organizationId ? { organization_id: organizationId } : {}),
    },
    description: `Proposal: ${proposal.title}`,
  });

  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    invoice: invoice.id,
    amount,
    currency,
    description: proposal.document.title || proposal.title,
    metadata: {
      proposal_id: proposal.id,
    },
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: true });

  return {
    invoiceId: finalized.id,
    hostedInvoiceUrl: finalized.hosted_invoice_url,
    stripeCustomerId,
  };
}

export async function createCheckoutSessionForProposal(
  stripe: Stripe,
  proposal: ProposalRecord,
  crm: CustomerRecord,
  origin: string,
  organizationId: string | undefined,
  mode: "payment" | "subscription",
  subscriptionPriceId: string | undefined,
): Promise<{ url: string | null; stripeCustomerId: string; createdStripeCustomer: boolean }> {
  const ensured = await ensureStripeCustomer(stripe, crm, organizationId);
  const { stripeCustomerId, created: createdStripeCustomer } = ensured;
  const amount = computeProposalTotalMinor(proposal);
  const currency = resolveProposalCurrency(proposal);

  const successUrl = `${origin}/customer?stripe_session={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/customer?stripe_checkout=cancel`;

  if (mode === "subscription") {
    if (!subscriptionPriceId?.trim()) {
      throw new Error("Configure a Stripe Price id for subscriptions (subscriptionPriceId).");
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: ensured.stripeCustomerId,
      line_items: [{ price: subscriptionPriceId.trim(), quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        proposal_id: proposal.id,
        ...(organizationId ? { organization_id: organizationId } : {}),
      },
    });
    return { url: session.url, stripeCustomerId, createdStripeCustomer };
  }

  if (amount < 50) {
    throw new Error(
      "Computed proposal total is below the Stripe minimum (50 minor units). Add pricing or package selections.",
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: ensured.stripeCustomerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amount,
          product_data: {
            name: proposal.title,
            metadata: { proposal_id: proposal.id },
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      proposal_id: proposal.id,
      ...(organizationId ? { organization_id: organizationId } : {}),
    },
  });

  return { url: session.url, stripeCustomerId, createdStripeCustomer };
}
