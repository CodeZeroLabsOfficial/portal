import { NextResponse } from "next/server";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { getStripe } from "@/lib/stripe/server";
import { getCustomerRecordForOrg, syncStripeCustomerBasics } from "@/server/firestore/crm-customers";
import { ensureStripeCustomer } from "@/server/stripe/proposal-billing";

interface Body {
  customerId?: string;
}

/** Staff-only: create SetupIntent for collecting a reusable card payment method. */
export async function POST(req: Request) {
  const user = await getCurrentSessionUser();
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured on the server." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const customerId = body.customerId?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "Customer is required." }, { status: 400 });
  }

  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  try {
    const { stripeCustomerId, created } = await ensureStripeCustomer(stripe, customer, user.organizationId);
    if (created || customer.stripeCustomerId !== stripeCustomerId) {
      await syncStripeCustomerBasics(user, customer.id, stripeCustomerId);
    }

    const intent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        crm_customer_id: customer.id,
        ...(user.organizationId ? { organization_id: user.organizationId } : {}),
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
