import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getServerEnv } from "@/lib/env/server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { logError, logInfo } from "@/lib/logging";
import { getStripe } from "@/lib/stripe/server";
import { applyStripeWebhookEvent } from "@/server/stripe/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook — verify signature with STRIPE_WEBHOOK_SECRET, then mirror Customers,
 * Subscriptions, Invoices, and PaymentIntents into Firestore (idempotent per event id).
 */
export async function POST(request: Request) {
  const env = getServerEnv();
  const stripe = getStripe();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    logError("stripe_webhook_misconfigured");
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 500 });
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    logError("stripe_webhook_no_firestore");
    return NextResponse.json({ error: "Database is not configured." }, { status: 500 });
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

  try {
    await applyStripeWebhookEvent(db, event);
  } catch (err) {
    logError("stripe_webhook_apply_failed", {
      message: err instanceof Error ? err.message : String(err),
      type: event.type,
      id: event.id,
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  logInfo("stripe_webhook_ok", { type: event.type, id: event.id });
  return NextResponse.json({ received: true });
}
