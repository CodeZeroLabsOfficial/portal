import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { isStaff, getCurrentSessionUser } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { logError } from "@/lib/logging";
import { getStripe } from "@/lib/stripe/server";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getCustomerRecordForOrg } from "@/server/firestore/crm-customers";
import { getAdminProposalRecord } from "@/server/firestore/portal-data";
import { createStripeInvoiceForProposal } from "@/server/stripe/proposal-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff-only — finalizes a Stripe invoice from proposal totals (pricing + accepted package selections). */
export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isStaff(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const proposalId =
    typeof body === "object" && body !== null && "proposalId" in body
      ? String((body as { proposalId?: unknown }).proposalId ?? "").trim()
      : "";
  if (!proposalId) {
    return NextResponse.json({ error: "proposalId is required." }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured on the server." }, { status: 503 });
  }

  const proposal = await getAdminProposalRecord(user, proposalId);
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }
  if (!proposal.customerId?.trim()) {
    return NextResponse.json(
      { error: "Link this proposal to a CRM customer before creating an invoice." },
      { status: 400 },
    );
  }

  const crm = await getCustomerRecordForOrg(user, proposal.customerId);
  if (!crm) {
    return NextResponse.json({ error: "CRM customer not found." }, { status: 404 });
  }

  try {
    const result = await createStripeInvoiceForProposal(
      stripe,
      proposal,
      crm,
      user.organizationId,
    );

    const db = getFirebaseAdminFirestore();
    if (db) {
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

    return NextResponse.json({
      invoiceId: result.invoiceId,
      hostedInvoiceUrl: result.hostedInvoiceUrl,
      stripeCustomerId: result.stripeCustomerId,
    });
  } catch (err) {
    logError("stripe_proposal_invoice_failed", {
      message: err instanceof Error ? err.message : String(err),
      proposalId,
    });
    const message = err instanceof Error ? err.message : "Invoice creation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
