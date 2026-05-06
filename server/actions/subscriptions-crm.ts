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

function parseStartDateToUtcMs(startDateIso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateIso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return ms;
}

function addMonthsUtc(ms: number, months: number): number {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return Date.UTC(targetYear, normalizedMonth, clampedDay, 0, 0, 0, 0);
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
  if (!parsed.data.priceId.trim().startsWith("price_")) {
    return { ok: false, message: "Invalid Stripe price selected for this subscription." };
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

  const startAtMs = parseStartDateToUtcMs(parsed.data.startDate);
  if (!startAtMs) {
    return { ok: false, message: "Invalid subscription start date." };
  }
  const nowMs = Date.now();
  const todayStartMs = Date.UTC(
    new Date(nowMs).getUTCFullYear(),
    new Date(nowMs).getUTCMonth(),
    new Date(nowMs).getUTCDate(),
  );
  if (startAtMs < todayStartMs) {
    return { ok: false, message: "Start date cannot be in the past." };
  }
  const cancelAtMs = addMonthsUtc(startAtMs, parsed.data.durationMonths);
  const startAtUnix = Math.floor(startAtMs / 1000);
  const cancelAtUnix = Math.floor(cancelAtMs / 1000);

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
      ...(startAtMs > nowMs
        ? {
            trial_end: startAtUnix,
            billing_cycle_anchor: startAtUnix,
            proration_behavior: "none" as const,
          }
        : {}),
      cancel_at: cancelAtUnix,
      metadata: {
        crm_customer_id: customer.id,
        duration_months: String(parsed.data.durationMonths),
        start_date: parsed.data.startDate,
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
