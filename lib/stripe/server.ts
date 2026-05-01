import Stripe from "stripe";
import { getServerEnv } from "@/lib/env/server";

let stripeInstance: Stripe | null = null;

/**
 * Server-side Stripe SDK. Returns `null` when STRIPE_SECRET_KEY is unset.
 * Prefer Checkout + Customer Portal for subscriptions; webhooks update Firestore mirrors.
 */
export function getStripe(): Stripe | null {
  const secret = getServerEnv().STRIPE_SECRET_KEY;
  if (!secret) {
    return null;
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(secret, {
      typescript: true,
    });
  }
  return stripeInstance;
}
