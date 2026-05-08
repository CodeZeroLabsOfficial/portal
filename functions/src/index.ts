import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import Stripe from "stripe";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
let stripeClient: Stripe | null = null;

interface AuthContext {
  uid: string;
  stripeCustomerId: string;
}

interface UpdatePaymentMethodRequest {
  stripePaymentMethodId?: unknown;
  brand?: unknown;
  last4?: unknown;
  expMonth?: unknown;
  expYear?: unknown;
  isDefault?: unknown;
}

interface DeletePaymentMethodRequest {
  stripePmId?: unknown;
}

function getStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "STRIPE_SECRET_KEY is not configured.",
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secret, {typescript: true});
  }
  return stripeClient;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  return null;
}

async function requireAuthenticatedStripeUser(context: functions.https.CallableContext): Promise<AuthContext> {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const stripeCustomerId = asTrimmedString(userSnap.data()?.stripeCustomerId);
  if (!stripeCustomerId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No Stripe customer is linked to this account.",
    );
  }

  return {uid, stripeCustomerId};
}

function customerPaymentMethodsCollection(uid: string) {
  return db.collection("customers").doc(uid).collection("paymentMethods");
}

function stripeErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function normalizeCardBrand(brand: string | null, stripeBrand: string | null): string {
  return (brand ?? stripeBrand ?? "card").toLowerCase();
}

function extractStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

async function clearDefaultFlags(
  paymentMethodsCol: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
): Promise<void> {
  const allDocs = await paymentMethodsCol.get();
  if (allDocs.empty) return;
  const batch = db.batch();
  allDocs.docs.forEach((doc) => batch.set(doc.ref, {isDefault: false}, {merge: true}));
  await batch.commit();
}

export const updatePaymentMethod = functions.region("australia-southeast1").https.onCall(async (rawData, context) => {
  const auth = await requireAuthenticatedStripeUser(context);
  const data = (rawData ?? {}) as UpdatePaymentMethodRequest;

  const stripePaymentMethodId = asTrimmedString(data.stripePaymentMethodId);
  if (!stripePaymentMethodId || !stripePaymentMethodId.startsWith("pm_")) {
    throw new functions.https.HttpsError("invalid-argument", "A valid Stripe payment method ID is required.");
  }

  const expMonthInput = asInteger(data.expMonth);
  const expYearInput = asInteger(data.expYear);
  if (expMonthInput !== null && (expMonthInput < 1 || expMonthInput > 12)) {
    throw new functions.https.HttpsError("invalid-argument", "expMonth must be between 1 and 12.");
  }
  if (expYearInput !== null && expYearInput < 2000) {
    throw new functions.https.HttpsError("invalid-argument", "expYear must be a valid 4-digit year.");
  }

  const stripe = getStripe();
  const pm = await stripe.paymentMethods.retrieve(stripePaymentMethodId);
  if (pm.object !== "payment_method" || pm.type !== "card") {
    throw new functions.https.HttpsError("invalid-argument", "Payment method must be a card.");
  }
  const currentCustomerId = extractStripeCustomerId(pm.customer);
  if (currentCustomerId && currentCustomerId !== auth.stripeCustomerId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Payment method is attached to a different customer.",
    );
  }

  let attachedPm = pm;
  if (!currentCustomerId) {
    attachedPm = await stripe.paymentMethods.attach(stripePaymentMethodId, {
      customer: auth.stripeCustomerId,
    });
  }

  const isDefault = typeof data.isDefault === "boolean" ? data.isDefault : true;
  if (isDefault) {
    await stripe.customers.update(auth.stripeCustomerId, {
      invoice_settings: {default_payment_method: stripePaymentMethodId},
    });
  }

  const card = attachedPm.card;
  const paymentMethodsCol = customerPaymentMethodsCollection(auth.uid);
  if (isDefault) {
    await clearDefaultFlags(paymentMethodsCol);
  }

  const nowMs = Date.now();
  await paymentMethodsCol.doc(stripePaymentMethodId).set({
    type: "card",
    brand: normalizeCardBrand(asTrimmedString(data.brand), card?.brand ?? null),
    last4: asTrimmedString(data.last4) ?? card?.last4 ?? "****",
    expMonth: expMonthInput ?? card?.exp_month ?? 0,
    expYear: expYearInput ?? card?.exp_year ?? 0,
    isDefault,
    stripePmId: stripePaymentMethodId,
    updatedAtMs: nowMs,
  }, {merge: true});

  return {ok: true, stripePmId: stripePaymentMethodId, isDefault};
});

export const deletePaymentMethod = functions.region("australia-southeast1").https.onCall(async (rawData, context) => {
  const auth = await requireAuthenticatedStripeUser(context);
  const data = (rawData ?? {}) as DeletePaymentMethodRequest;
  const stripePmId = asTrimmedString(data.stripePmId);
  if (!stripePmId || !stripePmId.startsWith("pm_")) {
    throw new functions.https.HttpsError("invalid-argument", "A valid Stripe payment method ID is required.");
  }

  const stripe = getStripe();
  const paymentMethodsCol = customerPaymentMethodsCollection(auth.uid);
  const allPaymentMethodsSnap = await paymentMethodsCol.get();
  const toDelete = allPaymentMethodsSnap.docs.filter((doc) => {
    const stripeId = asTrimmedString(doc.data().stripePmId);
    return doc.id === stripePmId || stripeId === stripePmId;
  });
  const deletingDefault = toDelete.some((doc) => doc.data().isDefault === true);

  if (toDelete.length > 0) {
    const batch = db.batch();
    toDelete.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  try {
    const pm = await stripe.paymentMethods.retrieve(stripePmId);
    if (pm.object === "payment_method" && extractStripeCustomerId(pm.customer) === auth.stripeCustomerId) {
      await stripe.paymentMethods.detach(stripePmId);
    }
  } catch (error) {
    functions.logger.warn("deletePaymentMethod: could not detach payment method", {
      uid: auth.uid,
      stripePmId,
      message: stripeErrorMessage(error, "Unknown Stripe error"),
    });
  }

  if (deletingDefault) {
    const remainingSnap = await paymentMethodsCol.get();
    const nextDefault = remainingSnap.docs
      .map((doc) => asTrimmedString(doc.data().stripePmId) ?? doc.id)
      .find((id) => id.startsWith("pm_"));

    if (nextDefault) {
      await stripe.customers.update(auth.stripeCustomerId, {
        invoice_settings: {default_payment_method: nextDefault},
      });

      await clearDefaultFlags(paymentMethodsCol);
      await paymentMethodsCol.doc(nextDefault).set({isDefault: true}, {merge: true});
    } else {
      await stripe.customers.update(auth.stripeCustomerId, {
        // Stripe accepts null to clear the default PM; cast keeps TS happy.
        invoice_settings: {default_payment_method: null as unknown as string},
      });
    }
  }

  return {ok: true, stripePmId};
});

/** Health endpoint remains available for monitoring/deploy checks. */
export const crmHealth = functions.region("australia-southeast1").https.onRequest((_req, res) => {
  res.status(200).send("CRM Cloud Functions bundle loaded.");
});
