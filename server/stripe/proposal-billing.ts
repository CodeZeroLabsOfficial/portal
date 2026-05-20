import Stripe from "stripe";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { findProposalBlockById, iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import { resolveProposalCommerce, type ProposalStripeOneOffItem } from "@/lib/proposal-commerce";
import { packageCommitmentTotalMinor } from "@/lib/proposal-packages-totals";
import type { CustomerRecord } from "@/types/customer";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type { PackagesBlock, PricingBlock, ProposalBlock, ProposalRecord } from "@/types/proposal";
import { loadBillingCatalogForOrganization } from "@/server/catalog/billing-catalog";
import { chargeProposalOneOffItems } from "@/server/stripe/proposal-one-off-billing";

type ProposalBillingWalk = {
  pricingLinesTotalMinor: number;
  currency: string;
  pricingOneOffItems: ProposalStripeOneOffItem[];
};

function walkProposalBlocksForBilling(blocks: ProposalBlock[]): ProposalBillingWalk {
  let pricingLinesTotalMinor = 0;
  let currency: string = DEFAULT_CURRENCY;
  let currencyResolved = false;
  const pricingOneOffItems: ProposalStripeOneOffItem[] = [];

  for (const block of iterateProposalContentBlocks(blocks)) {
    if (block.type === "pricing" || block.type === "packages") {
      if (!currencyResolved) {
        currency = block.currency.toLowerCase();
        currencyResolved = true;
      }
    }
    if (block.type !== "pricing") continue;
    const pb = block as PricingBlock;
    for (const line of pb.lineItems) {
      const qty = effectivePricingLineQuantity(line);
      pricingLinesTotalMinor += Math.round(line.unitAmountMinor * qty);
      if (qty <= 0) continue;
      pricingOneOffItems.push({
        amountMinor: line.unitAmountMinor,
        quantity: qty,
        currency,
        description: line.label?.trim() || pb.title?.trim() || "Line item",
      });
    }
  }

  return { pricingLinesTotalMinor, currency, pricingOneOffItems };
}

/** Sum pricing blocks and accepted package selections (recurring commitment + one-offs). */
export function computeProposalTotalMinor(
  proposal: ProposalRecord,
  catalogServices?: readonly CatalogServicePickerOption[],
): number {
  const { pricingLinesTotalMinor } = walkProposalBlocksForBilling(proposal.document.blocks);
  let total = pricingLinesTotalMinor;
  const blocks = proposal.document.blocks;

  if (proposal.publicSelections) {
    for (const [blockId, sel] of Object.entries(proposal.publicSelections)) {
      if (sel.kind !== "packages") continue;
      const raw = findProposalBlockById(blocks, blockId);
      if (!raw || raw.type !== "packages") continue;
      const pb = raw as PackagesBlock;
      if (!pb.tiers.some((t) => t.id === sel.tierId)) continue;
      total += packageCommitmentTotalMinor(pb, sel, catalogServices);
    }
  }

  return total;
}

/** One-off package charges + pricing blocks (for payment checkout / invoices). */
export function computeProposalOneOffTotalMinor(
  proposal: ProposalRecord,
  catalogServices?: readonly CatalogServicePickerOption[],
): number {
  const { pricingLinesTotalMinor } = walkProposalBlocksForBilling(proposal.document.blocks);
  let total = pricingLinesTotalMinor;

  const commerce = catalogServices
    ? resolveProposalCommerce(
        proposal,
        [...catalogServices],
        [],
      )
    : null;
  if (commerce) {
    total += commerce.oneOffTotalMinor;
  }

  return total;
}

export function resolveProposalCurrency(proposal: ProposalRecord): string {
  return walkProposalBlocksForBilling(proposal.document.blocks).currency;
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

function pricingBlockOneOffItems(proposal: ProposalRecord): ProposalStripeOneOffItem[] {
  return walkProposalBlocksForBilling(proposal.document.blocks).pricingOneOffItems;
}

export async function createStripeInvoiceForProposal(
  stripe: Stripe,
  proposal: ProposalRecord,
  crm: CustomerRecord,
  organizationId?: string,
): Promise<{ invoiceId: string; hostedInvoiceUrl: string | null; stripeCustomerId: string }> {
  const billingCatalog = await loadBillingCatalogForOrganization(organizationId);
  const commerce = resolveProposalCommerce(
    proposal,
    billingCatalog.catalogServices,
    billingCatalog.stripeProductCatalog,
  );

  const oneOffItems: ProposalStripeOneOffItem[] = [
    ...pricingBlockOneOffItems(proposal),
    ...(commerce?.oneOffItems ?? []),
  ];

  if (oneOffItems.length === 0) {
    const legacyAmount = computeProposalTotalMinor(proposal, billingCatalog.catalogServices);
    if (legacyAmount < 50) {
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
      amount: legacyAmount,
      currency,
      description: proposal.document.title || proposal.title,
      metadata: { proposal_id: proposal.id },
    });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: true });
    return {
      invoiceId: finalized.id,
      hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
      stripeCustomerId,
    };
  }

  const { stripeCustomerId } = await ensureStripeCustomer(stripe, crm, organizationId);
  const result = await chargeProposalOneOffItems({
    stripe,
    stripeCustomerId,
    items: oneOffItems,
    organizationId,
    proposalId: proposal.id,
    proposalTitle: proposal.title,
    collectionMethod: "send_invoice",
    daysUntilDue: 14,
  });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return {
    invoiceId: result.invoiceId,
    hostedInvoiceUrl: result.hostedInvoiceUrl,
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
  checkoutUrls?: { successUrl: string; cancelUrl: string },
): Promise<{ url: string | null; stripeCustomerId: string; createdStripeCustomer: boolean }> {
  const ensured = await ensureStripeCustomer(stripe, crm, organizationId);
  const { stripeCustomerId, created: createdStripeCustomer } = ensured;
  const currency = resolveProposalCurrency(proposal);

  const successUrl = checkoutUrls?.successUrl ?? `${origin}/customer?stripe_session={CHECKOUT_SESSION_ID}`;
  const cancelUrl = checkoutUrls?.cancelUrl ?? `${origin}/customer?stripe_checkout=cancel`;

  const billingCatalog = await loadBillingCatalogForOrganization(organizationId);
  const commerce = resolveProposalCommerce(
    proposal,
    billingCatalog.catalogServices,
    billingCatalog.stripeProductCatalog,
  );

  if (mode === "subscription") {
    const subscriptionItems = commerce?.subscriptionItems ?? [];
    if (subscriptionItems.length === 0) {
      const fallbackId = subscriptionPriceId?.trim();
      if (!fallbackId) {
        throw new Error(
          "Configure a subscription from package selection or pass subscriptionPriceId.",
        );
      }
      subscriptionItems.push({ priceId: fallbackId, quantity: 1, label: "Plan" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: ensured.stripeCustomerId,
      line_items: subscriptionItems.map((item) => ({
        price: item.priceId,
        quantity: Math.max(1, item.quantity),
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        proposal_id: proposal.id,
        ...(organizationId ? { organization_id: organizationId } : {}),
      },
    });
    return { url: session.url, stripeCustomerId, createdStripeCustomer };
  }

  const oneOffItems: ProposalStripeOneOffItem[] = [
    ...pricingBlockOneOffItems(proposal),
    ...(commerce?.oneOffItems ?? []),
  ];

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const item of oneOffItems) {
    const qty = Math.max(1, Math.floor(item.quantity));
    if (item.priceId?.trim()) {
      line_items.push({ price: item.priceId.trim(), quantity: qty });
      continue;
    }
    if (typeof item.amountMinor === "number") {
      line_items.push({
        quantity: qty,
        price_data: {
          currency: item.currency.toLowerCase(),
          unit_amount: item.amountMinor,
          product_data: {
            name: item.description,
            metadata: { proposal_id: proposal.id },
          },
        },
      });
    }
  }

  if (line_items.length === 0) {
    const amount = computeProposalOneOffTotalMinor(proposal, billingCatalog.catalogServices);
    if (amount < 50) {
      throw new Error(
        "No one-time charges to collect. Add pricing lines, upfront fees, or one-off add-ons.",
      );
    }
    line_items.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: amount,
        product_data: {
          name: proposal.title,
          metadata: { proposal_id: proposal.id },
        },
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: ensured.stripeCustomerId,
    line_items,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      proposal_id: proposal.id,
      ...(organizationId ? { organization_id: organizationId } : {}),
    },
  });

  return { url: session.url, stripeCustomerId, createdStripeCustomer };
}
