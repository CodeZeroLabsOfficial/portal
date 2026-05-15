import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { logError } from "@/lib/logging";
import { COLLECTIONS } from "@/server/firestore/collections";
import type { ProposalRecord } from "@/types/proposal";

/**
 * After a public proposal acceptance: move the linked deal to **Won** when the
 * proposal carries an `opportunityId` (no proposal `customerId` required). If both
 * the proposal and the opportunity specify a customer, they must match or we skip
 * Won and log. Also promotes **Lead → Contact** when a `customerId` is present.
 */
export async function applyProposalAcceptCrmSideEffects(
  db: Firestore,
  proposal: ProposalRecord,
  signerName: string,
): Promise<void> {
  const customerId = proposal.customerId?.trim();
  const opportunityId = proposal.opportunityId?.trim();
  const now = Timestamp.now();
  const orgId = proposal.organizationId?.trim();

  if (opportunityId) {
    try {
      const oppRef = db.collection(COLLECTIONS.opportunities).doc(opportunityId);
      const oppSnap = await oppRef.get();
      if (!oppSnap.exists) {
        logError("proposal_accept_opportunity_missing", { opportunityId, proposalId: proposal.id });
      } else {
        const data = oppSnap.data() as Record<string, unknown>;
        const oppCustomer =
          typeof data.customerId === "string" ? data.customerId.trim() : "";
        const bothCustomersKnown = Boolean(customerId) && Boolean(oppCustomer);
        const customerMismatch = bothCustomersKnown && oppCustomer !== customerId;
        if (customerMismatch) {
          logError("proposal_accept_opportunity_customer_mismatch", {
            opportunityId,
            proposalId: proposal.id,
            opportunityCustomerId: oppCustomer,
            proposalCustomerId: customerId,
          });
        } else {
          await oppRef.update({
            stage: "won",
            updatedAt: FieldValue.serverTimestamp(),
          });
          await db.collection(COLLECTIONS.opportunityActivities).add({
            opportunityId,
            ...(orgId ? { organizationId: orgId } : {}),
            kind: "other",
            title: "Services Agreement signed",
            detail: `Services agreement signed by ${signerName.trim()}`,
            authorUid: "",
            actorUid: "",
            occurredAt: now,
            createdAt: now,
          });
        }
      }
    } catch (e) {
      logError("proposal_accept_crm_won_failed", {
        proposalId: proposal.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (!customerId) return;

  try {
    const customerRef = db.collection(COLLECTIONS.customers).doc(customerId);
    const cSnap = await customerRef.get();
    if (!cSnap.exists) return;
    const raw = cSnap.data() as Record<string, unknown>;
    if (raw.crmType !== "lead") return;

    await customerRef.update({
      crmType: "contact",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection(COLLECTIONS.customerActivities).add({
      customerId,
      ...(orgId ? { organizationId: orgId } : {}),
      type: "other",
      title: "Lead promoted to contact",
      detail: `Services agreement signed by ${signerName.trim()}`,
      createdAt: now,
    });
  } catch (e) {
    logError("proposal_accept_crm_promote_contact_failed", {
      proposalId: proposal.id,
      customerId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Persists the selected subscription Price id on the CRM customer (merge) so
 * staff and checkout flows can align billing with the signed proposal.
 */
export async function persistCustomerSubscriptionIntentAfterAccept(
  db: Firestore,
  proposal: ProposalRecord,
  stripePriceId: string,
  planSummary: string,
  nowMs: number,
): Promise<void> {
  const customerId = proposal.customerId?.trim();
  if (!customerId || !stripePriceId.trim()) return;
  try {
    await db.collection(COLLECTIONS.customers).doc(customerId).set(
      {
        pendingStripeSubscription: {
          proposalId: proposal.id,
          proposalTitle: proposal.title,
          stripePriceId: stripePriceId.trim(),
          planSummary: planSummary.trim() || proposal.title,
          recordedAt: nowMs,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    logError("proposal_accept_pending_subscription_write_failed", {
      proposalId: proposal.id,
      customerId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
