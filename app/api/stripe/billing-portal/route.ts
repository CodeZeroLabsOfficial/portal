import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { logError } from "@/lib/logging";
import { getRequestOrigin } from "@/lib/stripe/request-origin";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates a Stripe Customer Billing Portal session for the signed-in portal user. */
export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!user.stripeCustomerId?.trim()) {
    return NextResponse.json(
      { error: "No Stripe customer is linked to this login yet. Ask your account manager to connect billing." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured on the server." }, { status: 503 });
  }

  const origin = getRequestOrigin(request);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId.trim(),
      return_url: `${origin}/customer`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    logError("stripe_billing_portal_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Could not start billing portal session." }, { status: 500 });
  }
}
