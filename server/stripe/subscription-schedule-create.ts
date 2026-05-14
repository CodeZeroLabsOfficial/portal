import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { logError } from "@/lib/logging";
import { COLLECTIONS } from "@/server/firestore/collections";
import type { CustomerRecord } from "@/types/customer";
import { ensureStripeCustomer } from "@/server/stripe/proposal-billing";
import { upsertSubscriptionMirror, mirrorSubscriptionRowToLinkedPortalUser } from "@/server/stripe/stripe-sync";

export function parseStartDateToUtcMs(startDateIso: string): number | null {
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

function addUtcMonthsClamped(startMs: number, months: number): number {
  const start = new Date(startMs);
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();
  const startDay = start.getUTCDate();
  const targetMonthIndex = startMonth + months;
  const targetYear = startYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const targetMonthLastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(startDay, targetMonthLastDay);
  return Date.UTC(targetYear, targetMonth, targetDay, 0, 0, 0, 0);
}

function productNameFromPriceObject(product: unknown): string | undefined {
  if (!product || typeof product !== "object") return undefined;
  const obj = product as { deleted?: boolean; name?: unknown; id?: unknown };
  if (obj.deleted === true) return typeof obj.id === "string" ? obj.id : undefined;
  if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();
  return typeof obj.id === "string" ? obj.id : undefined;
}

export type CreateSubscriptionScheduleParams = {
  stripe: Stripe;
  db: Firestore;
  customer: CustomerRecord;
  organizationId?: string;
  stripePriceId: string;
  startDateIso: string;
  durationMonths: number;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue?: number;
  defaultPaymentMethodId?: string;
  /** Extra keys merged into Stripe SubscriptionSchedule `metadata`. */
  extraScheduleMetadata?: Record<string, string>;
  /** When set, stored on `customerActivities.actorUid`. */
  activityActorUid?: string;
  activityTitle?: string;
};

/**
 * Creates a Stripe SubscriptionSchedule (same path as staff **Add subscription**).
 */
export async function createSubscriptionScheduleForCustomer(
  params: CreateSubscriptionScheduleParams,
): Promise<{ ok: true; subscriptionId: string } | { ok: false; message: string }> {
  const {
    stripe,
    db,
    customer,
    organizationId,
    stripePriceId: rawPriceId,
    startDateIso,
    durationMonths,
    collectionMethod,
    daysUntilDue,
    defaultPaymentMethodId,
    extraScheduleMetadata,
    activityActorUid,
    activityTitle = "Stripe subscription schedule created",
  } = params;

  const selectedPriceId = rawPriceId.trim();
  if (!selectedPriceId.startsWith("price_")) {
    return { ok: false, message: "Invalid Stripe price selected for this subscription." };
  }

  const startAtMs = parseStartDateToUtcMs(startDateIso);
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
    const { stripeCustomerId } = await ensureStripeCustomer(stripe, customer, organizationId);

    const price = await stripe.prices.retrieve(selectedPriceId, { expand: ["product"] });
    const intervalMonths = recurringIntervalMonths(price.recurring);
    if (!intervalMonths || intervalMonths <= 0) {
      return { ok: false, message: "Selected Stripe Price must be a recurring month/year price." };
    }
    if (durationMonths % intervalMonths !== 0) {
      return {
        ok: false,
        message: `Selected duration (${durationMonths} months) must align with billing interval (${intervalMonths} month cycle).`,
      };
    }
    const iterations = Math.max(1, Math.floor(durationMonths / intervalMonths));
    const subscriptionEnd = addUtcMonthsClamped(startAtMs, durationMonths);

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
        collection_method: collectionMethod,
        ...(collectionMethod === "send_invoice" ? { days_until_due: daysUntilDue ?? 14 } : {}),
        ...(defaultPaymentMethodId ? { default_payment_method: defaultPaymentMethodId } : {}),
      },
      metadata: {
        crm_customer_id: customer.id,
        duration_months: String(durationMonths),
        start_date: startDateIso,
        ...(organizationId ? { organization_id: organizationId } : {}),
        ...(extraScheduleMetadata ?? {}),
      },
    });

    const subscriptionId =
      typeof schedule.subscription === "string" ? schedule.subscription : schedule.subscription?.id;
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["default_payment_method", "items.data.price.product"],
      });
      await upsertSubscriptionMirror(db, subscription);
      const mergeFields = {
        stripeScheduleId: schedule.id,
        subscriptionStart: startAtMs,
        plannedDurationMonths: durationMonths,
        subscriptionEnd,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      await db.collection(COLLECTIONS.subscriptions).doc(subscriptionId).set(mergeFields, { merge: true });
      await mirrorSubscriptionRowToLinkedPortalUser(db, stripeCustomerId, subscriptionId, mergeFields);
    } else {
      const scheduledMonthlyAmountMinor =
        typeof price.unit_amount === "number"
          ? price.recurring?.interval === "year"
            ? Math.round(price.unit_amount / 12)
            : price.unit_amount
          : undefined;
      const scheduleRecord = {
        id: schedule.id,
        customerId: stripeCustomerId,
        ...(organizationId ? { organizationId } : {}),
        status: "scheduled" as const,
        priceId: selectedPriceId,
        ...(productNameFromPriceObject(price.product)
          ? { productName: productNameFromPriceObject(price.product) }
          : {}),
        currency: (price.currency ?? "aud").toLowerCase(),
        interval: price.recurring?.interval === "year" ? ("year" as const) : ("month" as const),
        collectionMethod,
        ...(typeof scheduledMonthlyAmountMinor === "number"
          ? { monthlyAmountMinor: scheduledMonthlyAmountMinor }
          : {}),
        createdAtMs: startAtMs,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
        stripeScheduleId: schedule.id,
        subscriptionStart: startAtMs,
        plannedDurationMonths: durationMonths,
        subscriptionEnd,
      };
      await db.collection(COLLECTIONS.subscriptions).doc(schedule.id).set(scheduleRecord, { merge: true });
      await mirrorSubscriptionRowToLinkedPortalUser(db, stripeCustomerId, schedule.id, scheduleRecord);
    }

    const activityPayload: Record<string, unknown> = {
      customerId: customer.id,
      type: "stripe_sync",
      title: activityTitle,
      detail: subscriptionId ?? schedule.id,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (organizationId) activityPayload.organizationId = organizationId;
    if (activityActorUid) activityPayload.actorUid = activityActorUid;

    await db.collection(COLLECTIONS.customerActivities).add(activityPayload);

    return { ok: true, subscriptionId: subscriptionId ?? schedule.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create subscription in Stripe.";
    logError("subscription_schedule_create_failed", { customerId: customer.id, message });
    return { ok: false, message };
  }
}
