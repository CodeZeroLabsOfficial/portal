import type { Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { COLLECTIONS } from "@/server/firestore/collections";

export type SubscriptionBillingContext = {
  scheduleId?: string;
  subscriptionId?: string;
  /** Schedule exists but billing has not started (`sub_sched_` with no subscription yet). */
  scheduleOnly: boolean;
};

export async function resolveSubscriptionBillingContext(
  stripe: Stripe,
  db: Firestore,
  id: string,
): Promise<SubscriptionBillingContext> {
  if (id.startsWith("sub_sched_")) {
    const schedule = await stripe.subscriptionSchedules.retrieve(id);
    const subscriptionId =
      typeof schedule.subscription === "string" ? schedule.subscription : schedule.subscription?.id;
    return {
      scheduleId: id,
      subscriptionId,
      scheduleOnly: !subscriptionId || schedule.status === "not_started",
    };
  }

  const doc = await db.collection(COLLECTIONS.subscriptions).doc(id).get();
  const storedScheduleId = doc.data()?.stripeScheduleId;
  if (typeof storedScheduleId === "string" && storedScheduleId.startsWith("sub_sched_")) {
    return { scheduleId: storedScheduleId, subscriptionId: id, scheduleOnly: false };
  }

  const sub = await stripe.subscriptions.retrieve(id);
  const scheduleFromSub =
    typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id ?? undefined;
  if (scheduleFromSub) {
    return { scheduleId: scheduleFromSub, subscriptionId: id, scheduleOnly: false };
  }

  return { subscriptionId: id, scheduleOnly: false };
}

/** Resolves a Stripe subscription id for billing actions (pause, resume, etc.). */
export async function resolveBillableSubscriptionId(
  stripe: Stripe,
  db: Firestore,
  id: string,
): Promise<string> {
  const ctx = await resolveSubscriptionBillingContext(stripe, db, id);
  if (ctx.scheduleOnly) {
    throw new Error("This subscription has not started yet and cannot be paused.");
  }
  if (!ctx.subscriptionId) {
    throw new Error("Invalid subscription id.");
  }
  return ctx.subscriptionId;
}
