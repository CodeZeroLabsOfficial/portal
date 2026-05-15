"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalFunctionsHealth = exports.deletePaymentMethod = exports.updatePaymentMethod = exports.setDefaultPaymentMethod = exports.listPaymentMethods = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const stripe_1 = __importDefault(require("stripe"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
let stripeClient = null;
function getStripe() {
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret) {
        throw new functions.https.HttpsError("failed-precondition", "STRIPE_SECRET_KEY is not configured.");
    }
    if (!stripeClient) {
        stripeClient = new stripe_1.default(secret, { typescript: true });
    }
    return stripeClient;
}
function asTrimmedString(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function asInteger(value) {
    if (typeof value === "number" && Number.isInteger(value))
        return value;
    return null;
}
async function requireAuthenticatedStripeUser(context) {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const stripeCustomerId = asTrimmedString(userSnap.data()?.stripeCustomerId);
    if (!stripeCustomerId) {
        throw new functions.https.HttpsError("failed-precondition", "No Stripe customer is linked to this account.");
    }
    return { uid, stripeCustomerId };
}
/** Firestore mirror for saved cards: `users/{uid}/paymentMethods` (Stripe is source of truth for attachments). */
function userPaymentMethodsCollection(uid) {
    return db.collection("users").doc(uid).collection("paymentMethods");
}
function stripeErrorMessage(error, fallback) {
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
        return error.message;
    }
    return fallback;
}
function normalizeCardBrand(brand, stripeBrand) {
    return (brand ?? stripeBrand ?? "card").toLowerCase();
}
function extractStripeCustomerId(customer) {
    if (!customer)
        return null;
    return typeof customer === "string" ? customer : customer.id;
}
async function clearDefaultFlags(paymentMethodsCol) {
    const allDocs = await paymentMethodsCol.get();
    if (allDocs.empty)
        return;
    const batch = db.batch();
    allDocs.docs.forEach((doc) => batch.set(doc.ref, { isDefault: false }, { merge: true }));
    await batch.commit();
}
/** List card payment methods attached to the signed-in user's Stripe customer (source of truth for the app). */
exports.listPaymentMethods = functions.region("australia-southeast1").https.onCall(async (_rawData, context) => {
    const auth = await requireAuthenticatedStripeUser(context);
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(auth.stripeCustomerId, {
        expand: ["invoice_settings.default_payment_method"],
    });
    if (customer.deleted || typeof customer === "string") {
        return { paymentMethods: [] };
    }
    let defaultPmId = null;
    const inv = customer.invoice_settings?.default_payment_method;
    if (inv && typeof inv === "object" && "id" in inv) {
        defaultPmId = inv.id;
    }
    else if (typeof inv === "string") {
        defaultPmId = inv;
    }
    const list = await stripe.paymentMethods.list({
        customer: auth.stripeCustomerId,
        type: "card",
        limit: 100,
    });
    const paymentMethods = list.data.map((pm) => {
        const card = pm.card;
        return {
            id: pm.id,
            stripePmId: pm.id,
            type: "card",
            brand: (card?.brand ?? "card").toLowerCase(),
            last4: card?.last4 ?? "****",
            expMonth: card?.exp_month ?? 0,
            expYear: card?.exp_year ?? 0,
            isDefault: pm.id === defaultPmId,
        };
    });
    return { paymentMethods };
});
/** Set Stripe invoice default payment method (must already be attached to this customer). */
exports.setDefaultPaymentMethod = functions.region("australia-southeast1").https.onCall(async (rawData, context) => {
    const auth = await requireAuthenticatedStripeUser(context);
    const data = (rawData ?? {});
    const stripePmId = asTrimmedString(data.stripePmId);
    if (!stripePmId || !stripePmId.startsWith("pm_")) {
        throw new functions.https.HttpsError("invalid-argument", "A valid Stripe payment method ID is required.");
    }
    const stripe = getStripe();
    const pm = await stripe.paymentMethods.retrieve(stripePmId);
    if (pm.object !== "payment_method" || pm.type !== "card") {
        throw new functions.https.HttpsError("invalid-argument", "Payment method must be a card.");
    }
    if (extractStripeCustomerId(pm.customer) !== auth.stripeCustomerId) {
        throw new functions.https.HttpsError("failed-precondition", "Payment method is not attached to this customer.");
    }
    await stripe.customers.update(auth.stripeCustomerId, {
        invoice_settings: { default_payment_method: stripePmId },
    });
    await clearDefaultFlags(userPaymentMethodsCollection(auth.uid));
    const nowMs = Date.now();
    const card = pm.card;
    await userPaymentMethodsCollection(auth.uid).doc(stripePmId).set({
        type: "card",
        brand: normalizeCardBrand(null, card?.brand ?? null),
        last4: card?.last4 ?? "****",
        expMonth: card?.exp_month ?? 0,
        expYear: card?.exp_year ?? 0,
        isDefault: true,
        stripePmId,
        updatedAt: nowMs,
    }, { merge: true });
    return { ok: true, stripePmId };
});
exports.updatePaymentMethod = functions.region("australia-southeast1").https.onCall(async (rawData, context) => {
    const auth = await requireAuthenticatedStripeUser(context);
    const data = (rawData ?? {});
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
        throw new functions.https.HttpsError("failed-precondition", "Payment method is attached to a different customer.");
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
            invoice_settings: { default_payment_method: stripePaymentMethodId },
        });
    }
    const card = attachedPm.card;
    const paymentMethodsCol = userPaymentMethodsCollection(auth.uid);
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
        updatedAt: nowMs,
    }, { merge: true });
    return { ok: true, stripePmId: stripePaymentMethodId, isDefault };
});
exports.deletePaymentMethod = functions.region("australia-southeast1").https.onCall(async (rawData, context) => {
    const auth = await requireAuthenticatedStripeUser(context);
    const data = (rawData ?? {});
    const stripePmId = asTrimmedString(data.stripePmId);
    if (!stripePmId || !stripePmId.startsWith("pm_")) {
        throw new functions.https.HttpsError("invalid-argument", "A valid Stripe payment method ID is required.");
    }
    const stripe = getStripe();
    const pmCol = userPaymentMethodsCollection(auth.uid);
    const snap = await pmCol.get();
    const allDocs = snap.docs;
    const toDeleteByPath = new Map();
    for (const doc of allDocs) {
        const stripeId = asTrimmedString(doc.data().stripePmId);
        if (doc.id === stripePmId || stripeId === stripePmId) {
            toDeleteByPath.set(doc.ref.path, doc);
        }
    }
    const toDelete = Array.from(toDeleteByPath.values());
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
    }
    catch (error) {
        functions.logger.warn("deletePaymentMethod: could not detach payment method", {
            uid: auth.uid,
            stripePmId,
            message: stripeErrorMessage(error, "Unknown Stripe error"),
        });
    }
    if (deletingDefault) {
        const remainingStripe = await stripe.paymentMethods.list({
            customer: auth.stripeCustomerId,
            type: "card",
            limit: 100,
        });
        const nextDefault = remainingStripe.data[0]?.id;
        if (nextDefault) {
            await stripe.customers.update(auth.stripeCustomerId, {
                invoice_settings: { default_payment_method: nextDefault },
            });
            await clearDefaultFlags(pmCol);
            await pmCol.doc(nextDefault).set({ isDefault: true }, { merge: true });
        }
        else {
            await stripe.customers.update(auth.stripeCustomerId, {
                invoice_settings: { default_payment_method: null },
            });
        }
    }
    return { ok: true, stripePmId };
});
/**
 * HTTP health check (Gen1 `onRequest`). Renamed from `crmHealth` because Firebase does not allow
 * changing an existing function between callable and HTTP — deploy a new name, then delete the old one.
 */
exports.portalFunctionsHealth = functions.region("australia-southeast1").https.onRequest((_req, res) => {
    res.status(200).send("Portal Cloud Functions bundle loaded.");
});
//# sourceMappingURL=index.js.map