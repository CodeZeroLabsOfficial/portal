import { utcDateIsoFromMillis } from "@/lib/date-utc-iso";
import { resolveFirstPackageSubscriptionFromProposal } from "@/lib/proposal-subscription-from-catalog";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { getStripe } from "@/lib/stripe/server";
import { COLLECTIONS } from "@/server/firestore/collections";
import { listStripeSubscriptionProductOptions } from "@/server/stripe/subscription-product-options";
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

/** When non-null, the agreement success state can offer the same subscription flow as admin. */
export async function loadProposalPublicSubscriptionUi(
  proposal: ProposalRecord,
): Promise<ProposalPublicSubscriptionUi | null> {
  if (proposal.status !== "accepted" || !proposal.customerId?.trim()) return null;
  const stripe = getStripe();
  if (!stripe) return null;

  const catalog = await listStripeSubscriptionProductOptions();
  const pick = resolveFirstPackageSubscriptionFromProposal(proposal, catalog);
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
    typeof proposal.acceptedAtMs === "number" && Number.isFinite(proposal.acceptedAtMs)
      ? utcDateIsoFromMillis(proposal.acceptedAtMs)
      : "—";

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
