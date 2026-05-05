import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { COLLECTIONS } from "../firestore/collections";
import type { InvoiceStatus } from "../../types/invoice";
import type { SubscriptionStatus } from "../../types/subscription";

function mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
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

export async function upsertStripeCustomerMirror(db: Firestore, customer: Stripe.Customer): Promise<void> {
  const ref = db.collection(COLLECTIONS.stripeCustomers).doc(customer.id);
  await ref.set(
    {
      id: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
      metadata: customer.metadata ?? {},
      livemode: customer.livemode,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
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
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
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
    organizationId: metadataOrganizationId(sub),
    status: mapSubscriptionStatus(sub.status),
    priceId: typeof price?.id === "string" ? price.id : undefined,
    productName: productLabelFromSubscription(sub),
    currency: (sub.currency ?? price?.currency ?? "aud").toLowerCase(),
    interval,
    currentPeriodEndMs:
      typeof sub.current_period_end === "number" ? sub.current_period_end * 1000 : undefined,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    mrrAmount: subscriptionMrrMinor(sub),
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(record, { merge: true });
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

  await ref.set(
    {
      id: invoice.id,
      stripeInvoiceId: invoice.id,
      customerId,
      organizationId: metadataOrganizationId(invoice),
      status: mapInvoiceStatus(invoice.status),
      currency: (invoice.currency ?? "aud").toLowerCase(),
      amountDue: typeof invoice.amount_due === "number" ? invoice.amount_due : 0,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
      invoicePdf: invoice.invoice_pdf ?? undefined,
      issuedAtMs: issued,
      paidAtMs: paidAt,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function upsertPaymentIntentMirror(db: Firestore, pi: Stripe.PaymentIntent): Promise<void> {
  const ref = db.collection(COLLECTIONS.payments).doc(pi.id);
  const customerId =
    typeof pi.customer === "string"
      ? pi.customer
      : pi.customer && typeof pi.customer !== "string"
        ? pi.customer.id
        : "";

  await ref.set(
    {
      id: pi.id,
      stripePaymentIntentId: pi.id,
      customerId,
      organizationId: metadataOrganizationId(pi),
      currency: (pi.currency ?? "aud").toLowerCase(),
      amount: typeof pi.amount_received === "number" ? pi.amount_received : pi.amount,
      status: pi.status,
      description: pi.description ?? undefined,
      createdAtMs: typeof pi.created === "number" ? pi.created * 1000 : Date.now(),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
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
          await db
            .collection(COLLECTIONS.subscriptions)
            .doc(sub.id)
            .set(
              {
                status: "canceled",
                updatedAtMs: Date.now(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
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
