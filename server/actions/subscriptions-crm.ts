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

function recurringIntervalMonths(
  recurring: { interval?: "day" | "week" | "month" | "year"; interval_count?: number } | null | undefined,
): number | null {
  if (!recurring?.interval) return null;
  const count = Number.isFinite(recurring.interval_count) ? Number(recurring.interval_count) : 1;
  if (recurring.interval === "month") return count;
  if (recurring.interval === "year") return count * 12;
  return null;
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
  const startAtUnix = Math.floor(startAtMs / 1000);

  try {
    const { stripeCustomerId, created } = await ensureStripeCustomer(stripe, customer, user.organizationId);
    if (created || customer.stripeCustomerId !== stripeCustomerId) {
      const synced = await syncStripeCustomerBasics(user, customer.id, stripeCustomerId);
      if (!synced.ok) {
        return { ok: false, message: synced.message };
      }
    }

    const selectedPriceId = parsed.data.priceId.trim();
    const price = await stripe.prices.retrieve(selectedPriceId);
    const intervalMonths = recurringIntervalMonths(price.recurring);
    if (!intervalMonths || intervalMonths <= 0) {
      return { ok: false, message: "Selected Stripe Price must be a recurring month/year price." };
    }
    if (parsed.data.durationMonths % intervalMonths !== 0) {
      return {
        ok: false,
        message: `Selected duration (${parsed.data.durationMonths} months) must align with billing interval (${intervalMonths} month cycle).`,
      };
    }
    const iterations = Math.max(1, Math.floor(parsed.data.durationMonths / intervalMonths));

    const schedule = await stripe.subscriptionSchedules.create({
      customer: stripeCustomerId,
      start_date: startAtMs <= nowMs ? "now" : startAtUnix,
      end_behavior: "cancel",
      phases: [
        {
          items: [{ price: selectedPriceId, quantity: 1 }],
          iterations,
          proration_behavior: "none",
        },
      ],
      default_settings: {
        collection_method: parsed.data.collectionMethod,
        ...(parsed.data.collectionMethod === "send_invoice"
          ? { days_until_due: parsed.data.daysUntilDue ?? 14 }
          : {}),
        ...(parsed.data.defaultPaymentMethodId
          ? { default_payment_method: parsed.data.defaultPaymentMethodId }
          : {}),
      },
      metadata: {
        crm_customer_id: customer.id,
        duration_months: String(parsed.data.durationMonths),
        start_date: parsed.data.startDate,
        ...(user.organizationId ? { organization_id: user.organizationId } : {}),
      },
    });

    const subscriptionId =
      typeof schedule.subscription === "string"
        ? schedule.subscription
        : schedule.subscription?.id;
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["default_payment_method", "items.data.price.product"],
      });
      await upsertSubscriptionMirror(db, subscription);
    }
    await db.collection(COLLECTIONS.customerActivities).add({
      customerId: customer.id,
      type: "stripe_sync",
      title: "Stripe subscription schedule created",
      detail: subscriptionId ?? schedule.id,
      actorUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    revalidateSubscriptionPaths(customer.id);
    return { ok: true, subscriptionId: subscriptionId ?? schedule.id };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create subscription in Stripe.",
    };
  }
}

export async function cancelSubscriptionAction(
  subscriptionId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };
  const stripe = getStripe();
  if (!stripe) return { ok: false, message: "Stripe is not configured on the server." };
  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };
  const subId = subscriptionId.trim();
  if (!subId.startsWith("sub_")) return { ok: false, message: "Invalid subscription id." };
  try {
    const updated = await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
      expand: ["default_payment_method", "items.data.price.product"],
    });
    await upsertSubscriptionMirror(db, updated);
    revalidateSubscriptionPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not cancel subscription.",
    };
  }
}

export async function deleteSubscriptionAction(
  subscriptionId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };
  const stripe = getStripe();
  if (!stripe) return { ok: false, message: "Stripe is not configured on the server." };
  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };
  const subId = subscriptionId.trim();
  if (!subId.startsWith("sub_")) return { ok: false, message: "Invalid subscription id." };
  try {
    const canceled = await stripe.subscriptions.cancel(subId);
    await upsertSubscriptionMirror(db, canceled);
    revalidateSubscriptionPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete subscription.",
    };
  }
}
