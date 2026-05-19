import { utcDateIsoFromMillis } from "@/lib/date-utc-iso";
import { resolveFirstPackageSubscriptionFromProposal } from "@/lib/proposal-subscription-from-catalog";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { getStripe } from "@/lib/stripe/server";
import { COLLECTIONS } from "@/server/firestore/collections";
import { loadBillingCatalogForOrganization } from "@/server/catalog/billing-catalog";
import type { ProposalRecord } from "@/types/proposal";

export type ProposalPublicSubscriptionUi = {
  customerId: string;
  customerLabel: string;
  summary: {
    customer: string;
    product: string;
    duration: string;
    startsOnLabel: string;
  };
};

/** When non-null, the agreement block can show subscription billing (card setup before acceptance, create after). */
export async function loadProposalPublicSubscriptionUi(
  proposal: ProposalRecord,
): Promise<ProposalPublicSubscriptionUi | null> {
  if (proposal.status === "draft" || proposal.status === "declined" || proposal.status === "expired") {
    return null;
  }
  if (!proposal.customerId?.trim()) return null;
  const stripe = getStripe();
  if (!stripe) return null;

  const billingCatalog = await loadBillingCatalogForOrganization(proposal.organizationId);
  const pick = resolveFirstPackageSubscriptionFromProposal(
    proposal,
    billingCatalog.catalogServices,
    billingCatalog.stripeProductCatalog,
  );
  if (!pick) return null;

  const db = getFirebaseAdminFirestore();
  let customerLabel = proposal.recipientEmail?.trim() || "Customer";
  if (db) {
    try {
      const snap = await db.collection(COLLECTIONS.customers).doc(proposal.customerId.trim()).get();
      if (snap.exists) {
        const d = snap.data() as Record<string, unknown>;
        const company = typeof d.company === "string" ? d.company.trim() : "";
        const name = typeof d.name === "string" ? d.name.trim() : "";
        const email = typeof d.email === "string" ? d.email.trim() : "";
        customerLabel = company || name || email || customerLabel;
      }
    } catch {
      /* keep fallback */
    }
  }

  const startsOnLabel =
    proposal.status === "accepted" &&
    typeof proposal.acceptedAt === "number" &&
    Number.isFinite(proposal.acceptedAt)
      ? utcDateIsoFromMillis(proposal.acceptedAt)
      : "Upon acceptance";

  return {
    customerId: proposal.customerId.trim(),
    customerLabel,
    summary: {
      customer: customerLabel,
      product: pick.productName,
      duration: `${pick.durationMonths} months`,
      startsOnLabel,
    },
  };
}
