import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { logError } from "@/lib/logging";
import { resolveSubscriptionStripePriceIdFromProposal } from "@/lib/proposal-subscription-price";
import { getRequestOrigin } from "@/lib/stripe/request-origin";
import { getStripe } from "@/lib/stripe/server";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getCustomerRecordForPublicProposalCheckout } from "@/server/firestore/crm-customers";
import { getProposalRecordByShareToken } from "@/server/firestore/parse-proposal";
import { createCheckoutSessionForProposal } from "@/server/stripe/proposal-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, token-authenticated Stripe Checkout in **subscription** mode for the
 * Price id resolved from the proposal’s package tier (`stripePriceId`) or payment block.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const shareToken = typeof raw.shareToken === "string" ? raw.shareToken.trim() : "";
  if (shareToken.length < 8) {
    return NextResponse.json({ error: "shareToken is required." }, { status: 400 });
  }

  const proposal = await getProposalRecordByShareToken(shareToken);
  if (!proposal || proposal.status === "draft") {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }
  if (proposal.status !== "accepted") {
    return NextResponse.json(
      { error: "Sign and accept the proposal before starting subscription checkout." },
      { status: 409 },
    );
  }

  const priceId = resolveSubscriptionStripePriceIdFromProposal(proposal);
  if (!priceId) {
    return NextResponse.json(
      { error: "No subscription price is configured for this proposal." },
      { status: 400 },
    );
  }

  const customerId = proposal.customerId?.trim();
  if (!customerId) {
    return NextResponse.json(
      { error: "This proposal is not linked to a billing profile." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const crm = await getCustomerRecordForPublicProposalCheckout(customerId, proposal.organizationId);
  if (!crm) {
    return NextResponse.json({ error: "Customer record not found." }, { status: 404 });
  }

  const origin = getRequestOrigin(request);
  const tokenSeg = encodeURIComponent(shareToken);
  const checkoutUrls = {
    successUrl: `${origin}/p/${tokenSeg}?stripe_session={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/p/${tokenSeg}?stripe_checkout=cancel`,
  };

  try {
    const result = await createCheckoutSessionForProposal(
      stripe,
      proposal,
      crm,
      origin,
      proposal.organizationId,
      "subscription",
      priceId,
      checkoutUrls,
    );

    const db = getFirebaseAdminFirestore();
    if (db && result.createdStripeCustomer) {
      await db
        .collection(COLLECTIONS.customers)
        .doc(crm.id)
        .set(
          {
            stripeCustomerId: result.stripeCustomerId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    }

    return NextResponse.json({ url: result.url });
  } catch (err) {
    logError("public_proposal_subscription_checkout_failed", {
      proposalId: proposal.id,
      message: err instanceof Error ? err.message : String(err),
    });
    const message = err instanceof Error ? err.message : "Checkout creation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
