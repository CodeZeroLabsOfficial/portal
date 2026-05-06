"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { getStripe } from "@/lib/stripe/server";
import { createSubscriptionSchema } from "@/lib/schemas/subscription";
import { zodErrorToMessage } from "@/lib/zod-error";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getCustomerRecordForOrg, syncStripeCustomerBasics } from "@/server/firestore/crm-customers";
import { ensureStripeCustomer } from "@/server/stripe/proposal-billing";
import { upsertSubscriptionMirror } from "@/server/stripe/stripe-sync";

function revalidateSubscriptionPaths(customerId?: string) {
  revalidatePath("/admin/subscriptions", "layout");
  if (customerId) {
    revalidatePath(`/admin/customers/${customerId}`);
  }
}

export async function createSubscriptionAction(
  raw: unknown,
): Promise<{ ok: true; subscriptionId: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "You need an admin or team session to manage subscriptions." };
  }

  const parsed = createSubscriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    return { ok: false, message: "Database unavailable." };
  }
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, message: "Stripe is not configured on the server." };
  }

  const customer = await getCustomerRecordForOrg(user, parsed.data.customerId);
  if (!customer) {
    return { ok: false, message: "Customer not found." };
  }

  try {
    const { stripeCustomerId, created } = await ensureStripeCustomer(stripe, customer, user.organizationId);
    if (created || customer.stripeCustomerId !== stripeCustomerId) {
      const synced = await syncStripeCustomerBasics(user, customer.id, stripeCustomerId);
      if (!synced.ok) {
        return { ok: false, message: synced.message };
      }
    }

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: parsed.data.priceId.trim() }],
      collection_method: parsed.data.collectionMethod,
      ...(parsed.data.collectionMethod === "send_invoice"
        ? { days_until_due: parsed.data.daysUntilDue ?? 14 }
        : {}),
      ...(parsed.data.defaultPaymentMethodId ? { default_payment_method: parsed.data.defaultPaymentMethodId } : {}),
      metadata: {
        crm_customer_id: customer.id,
        ...(user.organizationId ? { organization_id: user.organizationId } : {}),
      },
      expand: ["default_payment_method", "items.data.price.product"],
    });

    await upsertSubscriptionMirror(db, subscription);
    await db.collection(COLLECTIONS.customerActivities).add({
      customerId: customer.id,
      type: "stripe_sync",
      title: "Stripe subscription created",
      detail: subscription.id,
      actorUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    revalidateSubscriptionPaths(customer.id);
    return { ok: true, subscriptionId: subscription.id };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create subscription in Stripe.",
    };
  }
}
