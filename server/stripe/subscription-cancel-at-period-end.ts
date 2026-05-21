import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { COLLECTIONS } from "@/server/firestore/collections";
import { resolveSubscriptionBillingContext } from "@/server/stripe/subscription-id-resolve";
import { upsertSubscriptionMirror } from "@/server/stripe/stripe-sync";

const SUBSCRIPTION_EXPAND = ["default_payment_method", "items.data.price.product"] as const;

function priceIdFromScheduleItem(item: Stripe.SubscriptionSchedule.Phase.Item): string {
  if (typeof item.price === "string") return item.price;
  if (item.price?.id) return item.price.id;
  if (typeof item.plan === "string") return item.plan;
  if (item.plan?.id) return item.plan.id;
  throw new Error("Subscription schedule phase is missing a price.");
}

function activePhaseIndex(schedule: Stripe.SubscriptionSchedule): number {
  const currentStart = schedule.current_phase?.start_date;
  if (typeof currentStart === "number") {
    const idx = schedule.phases.findIndex((phase) => phase.start_date === currentStart);
    if (idx >= 0) return idx;
  }

  const now = Math.floor(Date.now() / 1000);
  const idx = schedule.phases.findIndex(
    (phase) => phase.start_date <= now && (phase.end_date == null || phase.end_date > now),
  );
  return idx >= 0 ? idx : Math.max(0, schedule.phases.length - 1);
}

async function resolveScheduleContext(
  stripe: Stripe,
  db: Firestore,
  id: string,
): Promise<{ scheduleId?: string; subscriptionId?: string; scheduleOnly: boolean }> {
  return resolveSubscriptionBillingContext(stripe, db, id);
}

/** Scheduled subscriptions that have not started yet — cancel the schedule before billing begins. */
async function cancelFutureSchedule(stripe: Stripe, db: Firestore, scheduleId: string): Promise<void> {
  await stripe.subscriptionSchedules.cancel(scheduleId, {
    invoice_now: false,
    prorate: false,
  });
  await db.collection(COLLECTIONS.subscriptions).doc(scheduleId).set(
    {
      status: "canceled",
      cancelAtPeriodEnd: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function cancelStandaloneAtPeriodEnd(
  stripe: Stripe,
  db: Firestore,
  subscriptionId: string,
): Promise<void> {
  const updated = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
    expand: [...SUBSCRIPTION_EXPAND],
  });
  await upsertSubscriptionMirror(db, updated);
}

async function cancelScheduleManagedAtPeriodEnd(
  stripe: Stripe,
  db: Firestore,
  scheduleId: string,
  subscriptionId: string,
): Promise<void> {
  const [schedule, subscription] = await Promise.all([
    stripe.subscriptionSchedules.retrieve(scheduleId),
    stripe.subscriptions.retrieve(subscriptionId, { expand: [...SUBSCRIPTION_EXPAND] }),
  ]);

  const periodEnd = subscription.current_period_end;
  if (typeof periodEnd !== "number") {
    throw new Error("Could not determine the end of the current billing period.");
  }

  const phase = schedule.phases[activePhaseIndex(schedule)];
  if (!phase) {
    throw new Error("Subscription schedule has no active phase.");
  }

  await stripe.subscriptionSchedules.update(scheduleId, {
    end_behavior: "cancel",
    phases: [
      {
        items: phase.items.map((item) => ({
          price: priceIdFromScheduleItem(item),
          quantity: item.quantity ?? 1,
        })),
        start_date: phase.start_date,
        end_date: periodEnd,
        proration_behavior: "none",
      },
    ],
  });

  const updated = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: [...SUBSCRIPTION_EXPAND],
  });
  await upsertSubscriptionMirror(db, updated);
}

/** Cancel at end of the current billing period with no refund. */
export async function cancelSubscriptionAtPeriodEnd(
  stripe: Stripe,
  db: Firestore,
  id: string,
): Promise<void> {
  const ctx = await resolveScheduleContext(stripe, db, id);

  if (ctx.scheduleOnly && ctx.scheduleId) {
    await cancelFutureSchedule(stripe, db, ctx.scheduleId);
    return;
  }

  if (ctx.scheduleId && ctx.subscriptionId) {
    await cancelScheduleManagedAtPeriodEnd(stripe, db, ctx.scheduleId, ctx.subscriptionId);
    return;
  }

  if (!ctx.subscriptionId) {
    throw new Error("Invalid subscription id.");
  }

  await cancelStandaloneAtPeriodEnd(stripe, db, ctx.subscriptionId);
}
