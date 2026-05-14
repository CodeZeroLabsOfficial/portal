import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import {
  getCustomerRecordForPublicProposalCheckout,
  persistStripeCustomerIdOnCustomer,
} from "@/server/firestore/crm-customers";
import { getProposalRecordByShareToken } from "@/server/firestore/parse-proposal";
import { ensureStripeCustomer } from "@/server/stripe/proposal-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveForPublicProposal(shareToken: string, customerId: string) {
  const st = shareToken.trim();
  const cid = customerId.trim();
  if (st.length < 8 || !cid) {
    return { error: "Invalid request." as const };
  }
  const proposal = await getProposalRecordByShareToken(st);
  if (!proposal || proposal.status === "draft") {
    return { error: "Proposal not found." as const };
  }
  if (proposal.status === "declined" || proposal.status === "expired") {
    return { error: "Proposal is not available for billing setup." as const };
  }
  if (proposal.customerId?.trim() !== cid) {
    return { error: "Customer does not match this proposal." as const };
  }

  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured on the server." as const };

  const crm = await getCustomerRecordForPublicProposalCheckout(cid, proposal.organizationId);
  if (!crm) return { error: "Customer not found." as const };

  const { stripeCustomerId, created } = await ensureStripeCustomer(stripe, crm, proposal.organizationId);
  if (created || crm.stripeCustomerId !== stripeCustomerId) {
    await persistStripeCustomerIdOnCustomer(cid, stripeCustomerId);
  }

  return { stripe, stripeCustomerId, crm } as const;
}

/** Public (share-token scoped): create SetupIntent for the linked CRM customer. */
export async function POST(req: Request) {
  let body: { shareToken?: string; customerId?: string };
  try {
    body = (await req.json()) as { shareToken?: string; customerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const shareToken = typeof body.shareToken === "string" ? body.shareToken : "";
  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  const resolved = await resolveForPublicProposal(shareToken, customerId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const { stripe, stripeCustomerId, crm } = resolved;

  try {
    const intent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        crm_customer_id: crm.id,
        proposal_public: "1",
      },
    });
    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create setup intent." },
      { status: 500 },
    );
  }
}

/** Public: list saved cards + default PM for the proposal’s customer. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shareToken = searchParams.get("shareToken")?.trim() ?? "";
  const customerId = searchParams.get("customerId")?.trim() ?? "";
  const resolved = await resolveForPublicProposal(shareToken, customerId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const { stripe, stripeCustomerId } = resolved;

  try {
    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (stripeCustomer.deleted || typeof stripeCustomer === "string") {
      return NextResponse.json({ defaultPaymentMethodId: null, cards: [] });
    }

    const pms = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
      limit: 20,
    });

    const fromInvoiceSettings = stripeCustomer.invoice_settings?.default_payment_method;
    const invoiceDefaultId =
      fromInvoiceSettings && typeof fromInvoiceSettings === "object" && "id" in fromInvoiceSettings
        ? fromInvoiceSettings.id
        : undefined;

    const cards = pms.data.map((pm) => {
      const card = pm.card;
      const summary =
        card?.brand && card?.last4
          ? `${card.brand.toUpperCase()} •••• ${card.last4}${card.exp_month && card.exp_year ? ` · exp ${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}` : ""}`
          : "Saved card";
      return { id: pm.id, summary };
    });

    const defaultPaymentMethodId = invoiceDefaultId ?? cards[0]?.id ?? null;
    const defaultCard = cards.find((c) => c.id === defaultPaymentMethodId) ?? null;

    return NextResponse.json({
      defaultPaymentMethodId,
      defaultPaymentMethodSummary: defaultCard?.summary ?? null,
      cards,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not fetch payment methods." },
      { status: 500 },
    );
  }
}
