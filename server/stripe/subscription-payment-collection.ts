import type { Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { resolveBillableSubscriptionId } from "@/server/stripe/subscription-id-resolve";
import { upsertSubscriptionMirror } from "@/server/stripe/stripe-sync";

const SUBSCRIPTION_EXPAND = ["default_payment_method", "items.data.price.product"] as const;

/** Pause invoice collection — subscription stays active; invoices are voided during the pause. */
export async function pauseSubscriptionPaymentCollection(
  stripe: Stripe,
  db: Firestore,
  id: string,
): Promise<void> {
  const subscriptionId = await resolveBillableSubscriptionId(stripe, db, id);
  const updated = await stripe.subscriptions.update(subscriptionId, {
    pause_collection: { behavior: "void" },
    expand: [...SUBSCRIPTION_EXPAND],
  });
  await upsertSubscriptionMirror(db, updated);
}

/** Resume invoice collection after a payment-collection pause. */
export async function resumeSubscriptionPaymentCollection(
  stripe: Stripe,
  db: Firestore,
  id: string,
): Promise<void> {
  const subscriptionId = await resolveBillableSubscriptionId(stripe, db, id);
  const updated = await stripe.subscriptions.update(subscriptionId, {
    pause_collection: "",
    expand: [...SUBSCRIPTION_EXPAND],
  });
  await upsertSubscriptionMirror(db, updated);
}
