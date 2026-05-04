/**
 * Firebase Cloud Functions (optional) — lead conversion and opportunities are implemented
 * in Next.js server actions (`server/firestore/crm-opportunities.ts`) using the Admin SDK.
 *
 * Use this package when you need triggers callable from mobile clients without session cookies,
 * or to enforce invariants in Firestore rules + Functions instead of the app layer.
 *
 * Example extension point (not wired): mirror `customers` writes and ensure `crmType`
 * transitions from lead → contact always pair with an `opportunities` child doc — typically
 * unnecessary if all conversions go through `convertLeadToContactWithOpportunity`.
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
