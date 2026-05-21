"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { getStripe } from "@/lib/stripe/server";
import { logError } from "@/lib/logging";
import { resolveStripePriceIdForSubscription } from "@/lib/catalog-service-resolve";
import { createSubscriptionSchema } from "@/lib/schemas/subscription";
import { listCatalogServicePickerOptionsForOrg } from "@/server/firestore/catalog-services";
import { zodErrorToMessage } from "@/lib/zod-error";
import { getCustomerRecordForOrg, syncStripeCustomerBasics } from "@/server/firestore/crm-customers";
import { ensureStripeCustomer } from "@/server/stripe/proposal-billing";
import { cancelSubscriptionAtPeriodEnd } from "@/server/stripe/subscription-cancel-at-period-end";
import {
  pauseSubscriptionPaymentCollection,
  resumeSubscriptionPaymentCollection,
} from "@/server/stripe/subscription-payment-collection";
import { deleteSubscriptionMirrorFromFirestore } from "@/server/stripe/stripe-sync";
import {
  createSubscriptionScheduleForCustomer,
  parseStartDateToUtcMs,
} from "@/server/stripe/subscription-schedule-create";

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
  const catalogServices = await listCatalogServicePickerOptionsForOrg(user);
  const stripePriceId = resolveStripePriceIdForSubscription(
    parsed.data.serviceId,
    parsed.data.durationMonths,
    catalogServices,
  );
  if (!stripePriceId) {
    return {
      ok: false,
      message: "Selected service is not synced to Stripe for this duration. Activate the service in Services.",
    };
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

  const startAt = parseStartDateToUtcMs(parsed.data.startDate);
  if (!startAt) {
    return { ok: false, message: "Invalid subscription start date." };
  }
  const nowMs = Date.now();
  const todayStartMs = Date.UTC(
    new Date(nowMs).getUTCFullYear(),
    new Date(nowMs).getUTCMonth(),
    new Date(nowMs).getUTCDate(),
  );
  if (startAt < todayStartMs) {
    return { ok: false, message: "Start date cannot be in the past." };
  }

  try {
    const { stripeCustomerId, created } = await ensureStripeCustomer(stripe, customer, user.organizationId);
    if (created || customer.stripeCustomerId !== stripeCustomerId) {
      const synced = await syncStripeCustomerBasics(user, customer.id, stripeCustomerId);
      if (!synced.ok) {
        return { ok: false, message: synced.message };
      }
    }

    const scheduleResult = await createSubscriptionScheduleForCustomer({
      stripe,
      db,
      customer,
      organizationId: user.organizationId,
      stripePriceId,
      startDateIso: parsed.data.startDate,
      durationMonths: parsed.data.durationMonths,
      collectionMethod: parsed.data.collectionMethod,
      daysUntilDue:
        parsed.data.collectionMethod === "send_invoice" ? parsed.data.daysUntilDue ?? 14 : undefined,
      defaultPaymentMethodId:
        parsed.data.collectionMethod === "charge_automatically"
          ? parsed.data.defaultPaymentMethodId?.trim() || undefined
          : undefined,
      activityActorUid: user.uid,
      activityTitle: "New subscription created",
      activityDetail: (id) => `Stripe subscription reference (${id})`,
    });

    if (!scheduleResult.ok) return scheduleResult;

    revalidateSubscriptionPaths(customer.id);
    return scheduleResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create subscription in Stripe.";
    logError("subscription_create_failed", { customerId: customer.id, message });
    return { ok: false, message };
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
    await cancelSubscriptionAtPeriodEnd(stripe, db, subId);
    revalidateSubscriptionPaths();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel subscription.";
    logError("subscription_cancel_failed", { subscriptionId: subId, message });
    return { ok: false, message };
  }
}

export async function pauseSubscriptionAction(
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
    await pauseSubscriptionPaymentCollection(stripe, db, subId);
    revalidateSubscriptionPaths();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not pause subscription.";
    logError("subscription_pause_failed", { subscriptionId: subId, message });
    return { ok: false, message };
  }
}

export async function resumeSubscriptionAction(
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
    await resumeSubscriptionPaymentCollection(stripe, db, subId);
    revalidateSubscriptionPaths();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resume subscription.";
    logError("subscription_resume_failed", { subscriptionId: subId, message });
    return { ok: false, message };
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
    if (subId.startsWith("sub_sched_")) {
      await stripe.subscriptionSchedules.cancel(subId);
      await deleteSubscriptionMirrorFromFirestore(db, subId);
      revalidateSubscriptionPaths();
      return { ok: true };
    }

    const canceled = await stripe.subscriptions.cancel(subId);
    const customerId =
      typeof canceled.customer === "string" ? canceled.customer : canceled.customer?.id ?? "";
    await deleteSubscriptionMirrorFromFirestore(db, subId, customerId);
    revalidateSubscriptionPaths();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete subscription.";
    logError("subscription_delete_failed", { subscriptionId: subId, message });
    return { ok: false, message };
  }
}
