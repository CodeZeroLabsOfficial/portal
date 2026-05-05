/**
 * Firebase Cloud Functions (optional). Stripe webhooks are implemented in Next.js at
 * `POST /api/webhooks/stripe` (see `server/stripe/stripe-sync.ts` and `docs/STRIPE_SETUP.md`).
 * Deploy a Cloud HTTPS function only if your hosting model cannot expose that route publicly.
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";

if (!admin.apps.length) {
  admin.initializeApp();
}

/** Placeholder export so `firebase deploy` has a target; replace with real triggers as needed. */
export const crmHealth = functions.https.onRequest((_req, res) => {
  res.status(200).send("CRM Cloud Functions bundle loaded. Use Next.js server actions for conversion.");
});
