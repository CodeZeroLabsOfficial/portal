import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { COLLECTIONS } from "@/server/firestore/collections";
import { syncStripeCustomerIdFromCrmCustomerDoc } from "@/server/firestore/sync-portal-user-stripe";
import type { InvoiceStatus } from "../../types/invoice";
import type { SubscriptionStatus } from "../../types/subscription";

function mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  /** Stripe API may return `scheduled` before SDK types add it to `Subscription.Status`. */
  if ((status as string) === "scheduled") return "scheduled";
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    case "paused":
      return status;
    default:
      return "active";
  }
}

function mapInvoiceStatus(status: Stripe.Invoice.Status | null | undefined): InvoiceStatus {
  if (status == null) {
    return "open";
  }
  switch (status) {
    case "draft":
    case "open":
    case "paid":
    case "void":
    case "uncollectible":
      return status;
    default:
      return "open";
  }
}

function metadataOrganizationId(
  obj: Stripe.Subscription | Stripe.Invoice | Stripe.PaymentIntent | Stripe.Customer,
): string | undefined {
  const m = obj.metadata;
  if (!m || typeof m !== "object") return undefined;
  const raw = (m as Record<string, string>).organization_id ?? (m as Record<string, string>).organizationId;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function subscriptionMrrMinor(sub: Stripe.Subscription): number | undefined {
  let sum = 0;
  let found = false;
  for (const item of sub.items?.data ?? []) {
    const price = item.price;
    if (!price?.recurring || price.recurring.interval !== "month") continue;
    const qty = item.quantity ?? 1;
    const unit = price.unit_amount;
    if (typeof unit === "number") {
      sum += unit * qty;
      found = true;
    }
  }
  return found ? sum : undefined;
}

/** Recurring liability expressed as approximate monthly minor units (monthly + yearly ÷12, per Stripe line semantics). */
function subscriptionMonthlyAmountMinor(sub: Stripe.Subscription): number | undefined {
  let sum = 0;
  let found = false;
  for (const item of sub.items?.data ?? []) {
    const price = item.price;
    const recurring = price?.recurring;
    if (!recurring || typeof price.unit_amount !== "number") continue;
    const qty = item.quantity ?? 1;
    const totalMinor = price.unit_amount * qty;
    const intervalCount = recurring.interval_count ?? 1;
    if (recurring.interval === "month") {
      sum += Math.round(totalMinor / intervalCount);
      found = true;
    } else if (recurring.interval === "year") {
      sum += Math.round(totalMinor / (12 * intervalCount));
      found = true;
    }
  }
  return found ? sum : undefined;
}

function defaultPaymentMethodTypeFromSubscription(sub: Stripe.Subscription): string | undefined {
  const pm = sub.default_payment_method;
  if (pm && typeof pm === "object" && typeof (pm as Stripe.PaymentMethod).type === "string") {
    return (pm as Stripe.PaymentMethod).type;
  }
  return undefined;
}

function mapCollectionMethod(
  cm: Stripe.Subscription.CollectionMethod | null | undefined,
): "charge_automatically" | "send_invoice" | undefined {
  if (cm === "charge_automatically" || cm === "send_invoice") return cm;
  return undefined;
}

function stripeSubscriptionIdRef(value: unknown): string | undefined {
  if (typeof value === "string" && value.startsWith("sub_")) {
    return value;
  }
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
    const id = (value as { id: string }).id;
    if (id.startsWith("sub_")) return id;
  }
  return undefined;
}

/** Stripe subscription id (`sub_…`) when the invoice belongs to a subscription billing cycle. */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  type InvoiceParent = {
    type?: string;
    subscription_details?: { subscription?: unknown };
  };
  type LineParent = {
    type?: string;
    subscription_item_details?: { subscription?: unknown };
  };

  const parent = (invoice as Stripe.Invoice & { parent?: InvoiceParent }).parent;
  if (parent?.type === "subscription_details") {
    const fromParent = stripeSubscriptionIdRef(parent.subscription_details?.subscription);
    if (fromParent) return fromParent;
  }

  const fromLegacy = stripeSubscriptionIdRef(
    (invoice as Stripe.Invoice & { subscription?: unknown }).subscription,
  );
  if (fromLegacy) return fromLegacy;

  for (const line of invoice.lines?.data ?? []) {
    const lineParent = (line as Stripe.InvoiceLineItem & { parent?: LineParent }).parent;
    if (lineParent?.type === "subscription_item_details") {
      const fromLine = stripeSubscriptionIdRef(lineParent.subscription_item_details?.subscription);
      if (fromLine) return fromLine;
    }
  }

  return undefined;
}

async function resolvePortalUserIdForStripeCustomer(db: Firestore, stripeCustomerId: string): Promise<string | null> {
  const trimmed = stripeCustomerId.trim();
  if (!trimmed) return null;
  const snap = await db.collection(COLLECTIONS.users).where("stripeCustomerId", "==", trimmed).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/** Copies a subscription-shaped doc to `users/{uid}/subscriptions/{docId}` when `users.stripeCustomerId` matches. */
export async function mirrorSubscriptionRowToLinkedPortalUser(
  db: Firestore,
  stripeCustomerId: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const uid = await resolvePortalUserIdForStripeCustomer(db, stripeCustomerId);
  if (!uid) return;
  await db.collection(COLLECTIONS.users).doc(uid).collection("subscriptions").doc(docId).set(data, { merge: true });
}

/** Removes a subscription mirror from the org collection and linked portal user subcollection. */
export async function deleteSubscriptionMirrorFromFirestore(
  db: Firestore,
  subscriptionId: string,
  stripeCustomerId?: string,
): Promise<void> {
  const subId = subscriptionId.trim();
  if (!subId) return;

  let customerId = stripeCustomerId?.trim() ?? "";
  if (!customerId) {
    const snap = await db.collection(COLLECTIONS.subscriptions).doc(subId).get();
    if (snap.exists) {
      const data = snap.data();
      customerId = typeof data?.customerId === "string" ? data.customerId.trim() : "";
    }
  }

  await db.collection(COLLECTIONS.subscriptions).doc(subId).delete().catch(() => {});

  if (!customerId) return;
  const uid = await resolvePortalUserIdForStripeCustomer(db, customerId);
  if (!uid) return;
  await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection("subscriptions")
    .doc(subId)
    .delete()
    .catch(() => {});
}

function productLabelFromSubscription(sub: Stripe.Subscription): string | undefined {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  const prod = price?.product;
  if (prod && typeof prod === "object" && "name" in prod && typeof (prod as Stripe.Product).name === "string") {
    return (prod as Stripe.Product).name;
  }
  if (typeof price?.nickname === "string" && price.nickname.length > 0) return price.nickname;
  return undefined;
}

function scheduleIdFromSubscription(sub: Stripe.Subscription): string | undefined {
  const schedule = sub.schedule;
  if (typeof schedule === "string" && schedule.startsWith("sub_sched_")) return schedule;
  if (
    schedule &&
    typeof schedule === "object" &&
    typeof (schedule as { id?: unknown }).id === "string"
  ) {
    const id = (schedule as { id: string }).id;
    if (id.startsWith("sub_sched_")) return id;
  }
  return undefined;
}

/**
 * When a SubscriptionSchedule starts, Stripe creates a `sub_…` object but our pre-start mirror
 * lives under `sub_sched_…`. Merge schedule-only fields into the subscription record and remove
 * the placeholder doc so the directory shows one active row.
 */
async function reconcileSchedulePlaceholderMirror(
  db: Firestore,
  sub: Stripe.Subscription,
  record: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const scheduleId = scheduleIdFromSubscription(sub);
  if (!scheduleId) return record;

  const scheduleSnap = await db.collection(COLLECTIONS.subscriptions).doc(scheduleId).get();
  if (!scheduleSnap.exists) return record;

  const scheduleData = scheduleSnap.data() ?? {};
  if (scheduleData.status !== "scheduled" && scheduleSnap.id !== scheduleId) {
    return record;
  }

  const merged: Record<string, unknown> = {
    ...record,
    stripeScheduleId: scheduleId,
  };

  if (typeof scheduleData.plannedDurationMonths === "number") {
    merged.plannedDurationMonths = scheduleData.plannedDurationMonths;
  }
  if (merged.organizationId == null && typeof scheduleData.organizationId === "string") {
    merged.organizationId = scheduleData.organizationId;
  }
  if (merged.subscriptionStart == null && typeof scheduleData.subscriptionStart === "number") {
    merged.subscriptionStart = scheduleData.subscriptionStart;
  }
  if (merged.subscriptionEnd == null && typeof scheduleData.subscriptionEnd === "number") {
    merged.subscriptionEnd = scheduleData.subscriptionEnd;
  }
  if (
    merged.collectionMethod == null &&
    (scheduleData.collectionMethod === "charge_automatically" ||
      scheduleData.collectionMethod === "send_invoice")
  ) {
    merged.collectionMethod = scheduleData.collectionMethod;
  }
  if (!merged.productName && typeof scheduleData.productName === "string") {
    merged.productName = scheduleData.productName;
  }

  const customerId = typeof merged.customerId === "string" ? merged.customerId : "";
  await deleteSubscriptionMirrorFromFirestore(db, scheduleId, customerId);

  return merged;
}

export async function upsertStripeCustomerMirror(db: Firestore, customer: Stripe.Customer): Promise<void> {
  const ref = db.collection(COLLECTIONS.stripeCustomers).doc(customer.id);
  await ref.set(
    {
      id: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
      metadata: customer.metadata ?? {},
      livemode: customer.livemode,      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await linkStripeCustomerToCrm(db, customer);
}

async function linkStripeCustomerToCrm(db: Firestore, customer: Stripe.Customer): Promise<void> {
  const email = customer.email?.trim().toLowerCase();
  if (!email) return;
  try {
    const snap = await db.collection(COLLECTIONS.customers).where("email", "==", email).limit(25).get();
    for (const doc of snap.docs) {
      await doc.ref.set(
        {
          stripeCustomerId: customer.id,
          stripeSyncedAt: Date.now(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await syncStripeCustomerIdFromCrmCustomerDoc(db, doc.id);
    }
  } catch {
    /* ignore query failures — indexes / transient errors */
  }
}

export async function upsertSubscriptionMirror(db: Firestore, sub: Stripe.Subscription): Promise<void> {
  const ref = db.collection(COLLECTIONS.subscriptions).doc(sub.id);
  const item = sub.items?.data?.[0];
  const price = item?.price;
  const interval =
    price?.recurring?.interval === "year"
      ? "year"
      : price?.recurring?.interval === "month"
        ? "month"
        : undefined;

  const record = {
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "",
    ...(metadataOrganizationId(sub) ? { organizationId: metadataOrganizationId(sub) } : {}),
    status: mapSubscriptionStatus(sub.status),
    ...(typeof price?.id === "string" ? { priceId: price.id } : {}),
    ...(productLabelFromSubscription(sub) ? { productName: productLabelFromSubscription(sub) } : {}),
    currency: (sub.currency ?? price?.currency ?? "aud").toLowerCase(),
    ...(interval ? { interval } : {}),
    ...(typeof sub.start_date === "number" ? { subscriptionStart: sub.start_date * 1000 } : {}),
    ...(typeof sub.cancel_at === "number" ? { subscriptionEnd: sub.cancel_at * 1000 } : {}),
    ...(typeof sub.current_period_end === "number"
      ? { currentPeriodEnd: sub.current_period_end * 1000 }
      : {}),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    paymentCollectionPaused: Boolean(sub.pause_collection?.behavior),
    ...(typeof subscriptionMrrMinor(sub) === "number" ? { mrrAmount: subscriptionMrrMinor(sub) } : {}),
    ...(typeof subscriptionMonthlyAmountMinor(sub) === "number"
      ? { monthlyAmountMinor: subscriptionMonthlyAmountMinor(sub) }
      : {}),
    ...(typeof sub.created === "number" ? { createdAt: sub.created * 1000 } : {}),
    ...(mapCollectionMethod(sub.collection_method)
      ? { collectionMethod: mapCollectionMethod(sub.collection_method) }
      : {}),
    ...(defaultPaymentMethodTypeFromSubscription(sub)
      ? { defaultPaymentMethodType: defaultPaymentMethodTypeFromSubscription(sub) }
      : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const reconciled = await reconcileSchedulePlaceholderMirror(db, sub, record);

  await ref.set(reconciled, { merge: true });

  const uid = await resolvePortalUserIdForStripeCustomer(db, reconciled.customerId as string);
  if (uid) {
    await db
      .collection(COLLECTIONS.users)
      .doc(uid)
      .collection("subscriptions")
      .doc(sub.id)
      .set(reconciled, { merge: true });
  }
}

export async function upsertInvoiceMirror(db: Firestore, invoice: Stripe.Invoice): Promise<void> {
  const ref = db.collection(COLLECTIONS.invoices).doc(invoice.id);
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer && typeof invoice.customer !== "string"
        ? invoice.customer.id
        : "";

  const issued =
    typeof invoice.created === "number"
      ? invoice.created * 1000
      : typeof invoice.effective_at === "number"
        ? invoice.effective_at * 1000
        : Date.now();

  const paidAt =
    invoice.status === "paid" && typeof invoice.status_transitions?.paid_at === "number"
      ? invoice.status_transitions.paid_at * 1000
      : undefined;

  const subscriptionId = subscriptionIdFromInvoice(invoice);

  const invoiceRecord = {
    id: invoice.id,
    stripeInvoiceId: invoice.id,
    customerId,
    ...(subscriptionId ? { subscriptionId } : {}),
    organizationId: metadataOrganizationId(invoice),
    status: mapInvoiceStatus(invoice.status),
    currency: (invoice.currency ?? "aud").toLowerCase(),
    amountDue: typeof invoice.amount_due === "number" ? invoice.amount_due : 0,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
    invoicePdf: invoice.invoice_pdf ?? undefined,
    issuedAt: issued,
    paidAt: paidAt,    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(invoiceRecord, { merge: true });

  const uid = await resolvePortalUserIdForStripeCustomer(db, customerId);
  if (uid) {
    await db.collection(COLLECTIONS.users).doc(uid).collection("invoices").doc(invoice.id).set(invoiceRecord, { merge: true });
  }
}

export async function upsertPaymentIntentMirror(db: Firestore, pi: Stripe.PaymentIntent): Promise<void> {
  const ref = db.collection(COLLECTIONS.payments).doc(pi.id);
  const customerId =
    typeof pi.customer === "string"
      ? pi.customer
      : pi.customer && typeof pi.customer !== "string"
        ? pi.customer.id
        : "";

  const paymentRecord = {
    id: pi.id,
    stripePaymentIntentId: pi.id,
    customerId,
    organizationId: metadataOrganizationId(pi),
    currency: (pi.currency ?? "aud").toLowerCase(),
    amount: typeof pi.amount_received === "number" ? pi.amount_received : pi.amount,
    status: pi.status,
    description: pi.description ?? undefined,
    createdAt: typeof pi.created === "number" ? pi.created * 1000 : Date.now(),    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(paymentRecord, { merge: true });

  const uid = await resolvePortalUserIdForStripeCustomer(db, customerId);
  if (uid) {
    await db.collection(COLLECTIONS.users).doc(uid).collection("payments").doc(pi.id).set(paymentRecord, { merge: true });
  }
}

function isAlreadyExistsError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 6
  );
}

/**
 * Idempotent Stripe webhook application — mirrors Customers, Subscriptions, Invoices, PaymentIntents into Firestore.
 */
export async function applyStripeWebhookEvent(db: Firestore, event: Stripe.Event): Promise<void> {
  const ref = db.collection(COLLECTIONS.stripeWebhookEvents).doc(event.id);
  try {
    await ref.create({
      type: event.type,
      livemode: event.livemode,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      return;
    }
    throw err;
  }

  try {
    switch (event.type) {
      case "customer.created":
      case "customer.updated":
      case "customer.deleted": {
        const customer = event.data.object as Stripe.Customer;
        if (event.type === "customer.deleted") {
          await db.collection(COLLECTIONS.stripeCustomers).doc(customer.id).delete().catch(() => {});
          return;
        }
        await upsertStripeCustomerMirror(db, customer);
        return;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (event.type === "customer.subscription.deleted") {
          const patch = {
            status: "canceled" as const,            updatedAt: FieldValue.serverTimestamp(),
          };
          await db.collection(COLLECTIONS.subscriptions).doc(sub.id).set(patch, { merge: true });
          const cus = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";
          const uid = await resolvePortalUserIdForStripeCustomer(db, cus);
          if (uid) {
            await db.collection(COLLECTIONS.users).doc(uid).collection("subscriptions").doc(sub.id).set(patch, { merge: true });
          }
          return;
        }
        await upsertSubscriptionMirror(db, sub);
        return;
      }
      case "invoice.created":
      case "invoice.updated":
      case "invoice.finalized":
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.voided": {
        const invoice = event.data.object as Stripe.Invoice;
        await upsertInvoiceMirror(db, invoice);
        return;
      }
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await upsertPaymentIntentMirror(db, pi);
        return;
      }
      default:
        return;
    }
  } catch (err) {
    await ref.delete().catch(() => {});
    throw err;
  }
}
