import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getServerEnv } from "@/lib/env/server";
import { logError, logInfo } from "@/lib/logging";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint — verify signature with STRIPE_WEBHOOK_SECRET, then mirror subscription
 * and invoice state into Firestore (implement writes after Firestore helpers land).
 */
export async function POST(request: Request) {
  const env = getServerEnv();
  const stripe = getStripe();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    logError("stripe_webhook_misconfigured");
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const headerList = await headers();
  const signature = headerList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    logError("stripe_webhook_signature_invalid", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      logInfo("stripe_subscription_event", { type: event.type, id: event.id });
      break;
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.finalized":
      logInfo("stripe_invoice_event", { type: event.type, id: event.id });
      break;
    default:
      logInfo("stripe_webhook_unhandled", { type: event.type, id: event.id });
  }

  return NextResponse.json({ received: true });
}
